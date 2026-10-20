![Coverage Badge](./badges/coverage.svg)
[![License: AGPL v3](https://img.shields.io/badge/License-AGPL_v3-blue.svg)](https://www.gnu.org/licenses/agpl-3.0)

# Drimsheet

Drimsheet is an AI-powered, robust, auditable accounting software for companies, sole traders (business name owners), and individuals in Nigeria.\
It's a software for accountants and non-accountants alike.

Accounting-savvy users who want to be in control of everything can create journals, charts of accounts, etc.

Users with no accounting background are not left out. They can also track their income, expenses and taxes. Under the hood, Drimsheet will use accounting standards to set up their ledgers.\
\
Drimsheet was created with 💜 and distributed for free by [Osahon Oboite](https://osahon.dev)

## Table of Contents

- [Introduction](#introduction)
- [Requirements](#requirements)
- [Installation](#installation)
- [Running the core app](#running-the-core-app)
  - [Ingesting CBN exchange rates](#ingesting-cbn-exchange-rates)
  - [Testing](#testing)
  - [Linting and Formatting](#linting-and-formatting)
- [Documentation](#documentation)
- [Contributing](#contributing)

## Introduction

This repo contains the core accounting module of Drimsheet. It encompasses the central double-entry accounting engine, the Nigeria Tax Act (NTA) computation and filing integrations (via FIRS Tax ProMax), open banking reconciliations (via Mono), and exposes its tools securely to autonomous AI agents via an integrated Model Context Protocol (MCP) server.

## Requirements

- [PostgreSQL](https://www.postgresql.org/) (>=16)
- [Redis](https://redis.io/) (>=8)
- Node.js 22 (version range specified in `package.json`; use `nvm install && nvm use`)
- npm
- Backblaze B2 bucket and bucket-scoped application credentials
- API credentials for 3rd party integrations (Paystack, Mono, ZeptoMail) managed securely via Doppler

> **Note:** PostgreSQL and Redis can be installed locally or run as Docker containers using the [drimsheet-platforms](https://github.com/Drimsheet/drimsheet-platforms) repo.

## Installation

1. Clone the repo
2. Run `npm install`
3. Copy the environment variables from Doppler (dev) and save them in a `.env` file in the root directory. [Env URL](https://dashboard.doppler.com/workplace/b0fb8d6179aa66108eac/projects/drimsheet-core/configs/dev)

### Setting up platform services

The app requires running PostgreSQL and Redis instances. You have two options:

**Option A — Use the [drimsheet-platforms](https://github.com/Drimsheet/drimsheet-platforms) repo (recommended)**

1. Clone the [drimsheet-platforms](https://github.com/Drimsheet/drimsheet-platforms) repo
2. Follow its [Quick Start](https://github.com/Drimsheet/drimsheet-platforms#quick-start) instructions to spin up all services via Docker

**Option B — Install locally**

Install and run PostgreSQL and Redis on your machine and configure the connection details in your `.env` file.

### Running the core app

- Ensure PostgreSQL and Redis are running (see above)
- Run `yarn dev` (starts HTTP and route generation)
- Run `yarn dev:background` in another terminal for queue workers and scheduled jobs
- The app should now be running on `http://localhost:${PORT}`

### Ingesting CBN exchange rates

Exchange rates are ingested daily at **18:00 Africa/Lagos** by a separate
background process. Run `yarn dev:background` in another terminal for development,
or `yarn start:background` in production with one active instance.

Before the first ingestion, apply migrations and let HTTP finish bootstrapping
currency reference data.

See the [background runtime guide](src/infra/runtime/__docs__/README.md#background-process)
for scheduling and startup behavior, and the
[operations runbook](docs/observability-operations.md#cbn-exchange-rate-worker)
for deployment, monitoring, and shutdown.

### MCP server foundation

The existing HTTP process serves MCP at `/mcp` using the TypeScript SDK v2.
Node.js 20 or later is required. The endpoint exposes two read tools:

| Tool                  | Result                                                |
| --------------------- | ----------------------------------------------------- |
| `get_ledger_accounts` | Paginated ledger accounts with existing balance DTOs. |
| `get_journal_entries` | Paginated journal entries and their lines.            |

Both accept their existing query filters and pagination fields. Pagination
defaults to 10 results and allows up to 200 per page. Results preserve `data`
and `meta`, with JSON text and structured content. Dates are ISO strings and
monetary amounts retain their minor-unit representation and currency code.

With core running locally, discover tools using:

```bash
curl http://localhost:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Use the configured `PORT` if it differs from 3000. Outside `APP_ENV=local`,
requests must use the hostname configured in `APP_URL`; local mode also allows
loopback hostnames. Existing Origin checks, body limits, correlation IDs, and
rate limiting apply. The SDK owns protocol negotiation and response framing;
the verified `2025-06-18` request path returns SSE messages.

Authentication is deferred. Read calls retain the application use cases'
accounting-entity context prerequisite and fail safely when it is absent. The
integration suite supplies synthetic fixture context to verify tool reads;
live caller authentication and entity selection are separate work. No new MCP
credential or login flow is provided in this phase.

Run the focused protocol and integration tests with:

```bash
npm test -- --runInBand src/interface/mcp test/http/mcp src/infra/ioc/__specs__/mcp.spec.ts
```

### Testing

Run the test suite:

```bash
npm test
```

### Linting and Formatting

Format your code before submitting a PR:

```bash
npm run format:all
```

## Documentation

**[Architecture Documentation](docs/README.md)**: A comprehensive guide to the system's architecture, including technical constraints, domain models, and architectural decisions.

## Contributing

Please read the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.

## License

This project is licensed under the [GNU Affero General Public License v3.0 (AGPLv3)](LICENSE).
