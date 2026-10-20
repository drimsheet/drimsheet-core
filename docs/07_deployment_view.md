# 7. Deployment View

The Deployment View describes exactly where and how the Drimsheet Core software is deployed to run in the target environment. It explains the mapping from the codebase artifacts to the physical and virtual infrastructure nodes, as well as how configuration/secrets are injected into those nodes.

Drimsheet embraces a modern PaaS-driven containerized approach that prioritizes fast deployment speeds, simplified configuration via Doppler, and isolated dependencies using Coolify on DigitalOcean.

## 7.1 Infrastructure Architecture (Level 1)

At the highest level, the system relies on a single robust **DigitalOcean Droplet** serving as our Infrastructure as a Service (IaaS). Sitting atop this server is **Coolify**, an open-source Platform as a Service (PaaS) that manages our entire container lifecycle.

![Level 1: Deployment Infrastructure](./assets/07.1-deployment-infrastructure.mermaid.png)

_Figure 1: View the mermaid sourcecode here: [07.1-deployment-infrastructure.mermaid](./assets/07.1-deployment-infrastructure.mermaid)_

### 7.1.1 DigitalOcean Droplet (IaaS)

- **Role**: The foundational physical/virtual compute node.
- **Purpose**: Provides the CPU, RAM, and internal SSD bounds for the entire system suite.
- **Operating System**: Linux (Ubuntu).
- **Network Security**: External incoming traffic is restricted solely to standard web ports (80/443), with Coolify handling SSL termination and internal routing.

### 7.1.2 Coolify (PaaS) & Internal Containers

All internal systems run as Docker containers strictly managed and orchestrated by Coolify.

| Container / Node                          | Role / Technology          | Description                                                                                                                                                                      |
| ----------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Reverse Proxy**                         | Traefik / Caddy            | Handled natively by Coolify. Acts as the entry point, resolving domains, terminating SSL certificates (via Let's Encrypt), and forwarding requests to the Node.js API container. |
| **Drimsheet Core**                        | Node.js Runtime            | The monolith serving our API, Application, and Domain rules (compiled to JavaScript). Multiple instances/replicas can be spun up by Coolify based on load.                       |
| **Background runtime (not yet deployed)** | Node.js background process | Intended as a separate Coolify service; runs all queue workers and registered node-cron tasks. Exchange-rate ingestion runs daily at 18:00 Africa/Lagos.                         |
| **PostgreSQL**                            | Relational Database        | The primary transactional database where ledgers, journals, and official exchange rates are stored. Runs persistently on attached volumes ensuring ACID compliance.              |
| **Redis**                                 | In-Memory Data Store       | Acts as a fast response cache and the backbone for the background job processing (BullMQ / Bull Board).                                                                          |
| **Qdrant**                                | Vector Database            | Maintains semantic context and vector embeddings, particularly for enabling intelligent AI Agent integrations into the product.                                                  |

Configure Coolify's HTTP health check as `GET /health/ready` so replacement
containers receive traffic only when ready. See the
[runtime guide](../src/infra/runtime/__docs__/README.md#http-process) for readiness
and liveness semantics.

### 7.1.3 External Cloud Services

The Node.js API container relies entirely on these third-party systems via HTTPS interactions to fulfill external domains:

- **Backblaze B2**: S3-compatible object storage used for direct Web file uploads. Core issues short-lived upload grants but does not receive the file bytes.
- **Sentry**: Observability platform catching exceptions, runtime crashes, and tracing request performance.
- **Better Stack**: Receives canonical structured Winston logs and
  application-owned OpenTelemetry metrics directly from Core. It does not
  receive Sentry traces/errors or provider-native BullMQ inventory.
- **Doppler**: Centralized configuration management (discussed comprehensively in Section 7.3).
- **Core Systems**: FIRS Tax ProMax (taxation), Mono (open banking), Paystack (billing), and ZeptoMail (transactional email).
- **CBN**: Provides the official foreign-currency/NGN `centralrate` history used by the scheduled exchange-rate ingestion job.
- **Identity & Marketing**: Google Auth, Mailchimp, and MailerLite.

---

## 7.2 Deployment Mapping and Artifacts

The system is deployed as a consolidated **monolithic runtime architecture**. Even though our Domain Layer (see _5. Building Block View_) cleanly separates contexts such as Accounting, Bookkeeping, Journal Entry, Ledger, Currency, Subledger, and User, these blocks are not distributed as separate microservices.

The `main` branch owns prerelease deployments to staging. After the Core
prerelease succeeds, the approved changes are promoted independently to the
`release` branch, which owns production deployments.

**Mapping software to infrastructure:**

The HTTP and background processes share one container image and run as separate
services. See the [runtime guide](../src/infra/runtime/__docs__/README.md) for
entrypoints, startup ordering, and resource ownership.

- TypeScript code (found in `src/*`) maps directly to a **single Node.js Docker Container image** artifact.
- Coolify uses the **Nixpacks** build pack to generate the container build and
  run the repository's install and build scripts. There is no maintained
  Dockerfile in this repository.
- Nixpacks selects the Node major from `package.json`'s `engines.node`.
  A Coolify `NIXPACKS_NODE_VERSION` override takes precedence; keep it aligned
  or remove it. Verify that the resolved version in the build log satisfies
  the declared range. See [Nixpacks Node configuration](https://nixpacks.com/docs/providers/node).
- Only HTTP is currently deployed. For the existing single HTTP service, set
  Coolify's **Start Command** directly to
  `npm run db:migrate up && exec node ./dist/src/infra/runtime/process/http.process.js`.
  The final `exec` replaces the container's start shell with Node so termination
  signals reach the HTTP lifecycle. An `exec` inside an npm script only replaces
  npm's child shell; it does not replace the outer npm process.
- When deploying background processing, create one separate Coolify service from
  this repository with Start Command
  `exec node ./dist/src/infra/runtime/process/background.process.js`.
  It has no HTTP listener, domain, or `/health/ready` endpoint. Coolify supervises
  each service independently; running both processes in one container with PM2
  would be a separate deployment choice.
- Set the supervisor's termination grace period to allow HTTP draining and
  resource cleanup. Background shutdown needs more than 60 seconds to allow
  scheduled jobs to finish and clients to close. The supervisor enforces the
  final deadline; the [runtime guide](../src/infra/runtime/__docs__/README.md)
  defines shutdown guarantees and limitations.
- Currency reference data is bootstrapped by the HTTP runtime.
  Apply migrations and allow HTTP bootstrap to finish before the first background
  ingestion; this ordering is the developer's or deployment operator's responsibility.
  The exchange-rate job initializer reads `last_succeeded_at`
  from `core.background_job_checkpoints`. It executes ingestion at startup only
  when there was no success yesterday or today in Africa/Lagos, then starts
  node-cron for daily 18:00 Africa/Lagos execution. Scheduled runs do not check
  freshness. Completion is recorded after ingestion commits; conflict-ignore
  inserts make replays safe. No queue or automatic retry is used for ingestion.
- Run exactly one background process. For multiple HTTP replicas, apply migrations once,
  run one background service and use
  `exec node ./dist/src/infra/runtime/process/http.process.js` for the
  HTTP replicas. Node-cron's overlap prevention applies within one process;
  there is no distributed lock. Disable the old Coolify cron and any previously
  deployed BullMQ exchange-rate scheduler before switching.
- **Database Schema Mapping**: The Drizzle ORM schema represents the artifact for database structure. As a pre-start (or hook) step during deployment, Drizzle database migration scripts are applied to the PostgreSQL container to ensure code and table definitions remain deeply synchronized.

---

## 7.3 Configuration and Secret Management

Drimsheet does not store raw `.env` files anywhere in version control or directly on servers. We utilize **Doppler** to distribute secrets dynamically, guaranteeing strong security and auditing of environment configurations across all environments ("development", "staging", "production").

**The Configuration Lifecycle:**

1.  **Storage (Doppler)**: API keys, Backblaze application credentials, database passwords, and runtime flags are encrypted and updated purely on Doppler's platform.
2.  **Injection (Coolify Pipeline)**: When Coolify initiates a deployment of the Drimsheet Core, it utilizes the Doppler CLI (or Doppler Service Token) to securely pull and inject these keys into the Node.js Docker environment at startup.
3.  **Application Consumption (`vars.config.ts` & `IVarsConfig`)**: Within the codebase, configurations are not arbitrarily fetched. The file `src/infra/config/vars.config.ts` parses `process.env` and acts as the secure internal schema for the application. Application-layer code accesses these values through the `IVarsConfig` contract interface (`src/shared/contracts/vars-config.contract.ts`), ensuring that environment configuration does not leak into testable application logic.

### 7.3.1 Backblaze B2 upload configuration

Core requires these environment variables to issue direct upload instructions:

| Variable         | Purpose                                                                |
| ---------------- | ---------------------------------------------------------------------- |
| `B2_APP_KEY_ID`  | ID of the bucket-scoped Backblaze application key.                     |
| `B2_APP_KEY`     | Secret for the scoped application key.                                 |
| `B2_BUCKET_NAME` | Destination bucket name.                                               |
| `B2_S3_ENDPOINT` | Region endpoint, for example `https://s3.us-west-004.backblazeb2.com`. |
| `B2_REGION`      | Matching B2 region, for example `us-west-004`.                         |

The application key must be restricted to the configured bucket and include
only the file-write, file-read, and file-delete capabilities required to
prepare uploads, inspect claimed objects, and remove invalid objects
(`writeFiles`, `readFiles`, and `deleteFiles` in Backblaze capability terms).
Store the key ID and secret in Doppler; they must never be exposed to Web.

Configure the bucket CORS rule with each deployed Web origin explicitly. Allow
`PUT` and the `Content-Type` and `x-amz-meta-original-name` request headers
returned by Core. Do not use `*` for production origins. The browser must send
the upload request to `uploadUrl` with exactly the returned headers; Core
continues to accept JSON only.

Core generates every new B2 object key as
`<user_id>/<purpose>/<file_id>`. The bucket is configured separately and is not
part of the key. Original filenames are UTF-8 encoded into signed
`original-name` object metadata and never appear in object keys. During receipt
creation, Core reconstructs keys from the authenticated user, the journal-entry
attachment purpose, and opaque upload references; it never accepts client file
URLs for inspection or deletion.

Receipt attachments accept only PNG, JPEG, WebP, and PDF objects of no more
than 2 MiB each. Core validates stored size, MIME type, and leading-byte
signature before association and deletes rejected objects. Valid uploads that
are never claimed, valid objects left after a later receipt failure, and
single-use/exclusive claim enforcement are intentionally outside the current
lifecycle.
