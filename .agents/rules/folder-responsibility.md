# Folder Responsibility

Use the folder that owns the behavior.

## Layers

- `src/domain`: business invariants, entities, values, domain services, domain errors, domain events, and repo contracts. Imports only domain/shared.
- `src/app`: use cases, app services, policies, DTOs, app errors, ports, and application mappers. Imports app/domain/shared.
- `src/interface`: controllers, routes, middlewares, handlers, request parsing, response shaping, status mapping, and TSOA metadata.
- `src/infra`: concrete adapters, persistence, cache, queues, external clients, config, IoC, runtime, observability, and server bootstrap.
- `src/shared`: pure framework-neutral helpers and base primitives. Imports only shared.

## Infrastructure Integrations

- `src/infra/integrations/<provider-or-capability>` owns concrete adapters for
  named external platforms, including provider-specific clients, SDK setup,
  authentication, schemas, mapping, and bounded provider lifecycle behavior.
- System-facing contracts and DTOs remain owned by `src/app`, `src/domain`, or
  `src/shared`. Integrations implement or translate into those owned boundaries.
- Keep provider-neutral persistence, messaging, observability facades, process
  lifecycle coordination, HTTP delivery, IoC, and business rules in their
  established owning folders.
- Import concrete integrations directly. Do not add a provider registry, base
  adapter, or compatibility re-export without a current requirement.

## Rules

- Never import or use third-party libraries directly inside `src/domain`,
  including its tests. Use native language/runtime features or existing
  repository-owned domain/shared utilities.
- Domain must not know HTTP, Express, TSOA, Redis, Drizzle, env vars, cookies, queues, or logging.
- Controllers and middlewares orchestrate only. Business or app decisions go to domain/app.
- Use cases orchestrate domain/app behavior. Extract non-trivial rules to domain services, entities, values, or app policies.
- Only use cases initiate persistence. They may call repositories directly or
  invoke a dedicated persistence service that atomically composes repository
  writes. Domain and application services must not invoke write repositories or
  persistence services, except for the repository writes owned internally by a
  dedicated persistence service itself.
- Repositories store and retrieve data only. Persistence services compose only
  the repository writes and storage-level invariants required for an atomic
  persistence bundle; they do not own workflow ordering.
- Config files configure adapters. They are not helper folders.
- Shared must not contain product-specific rules or framework assumptions.
- Domain validations and helpers follow
  [Domain Validations And Helpers](domain-validations.md).
- Helpers outside the domain layer inherit the owner of the behavior they
  contain.

## Placement Check

1. Business invariant or state transition? `src/domain`.
2. Application workflow or policy? `src/app`.
3. HTTP or delivery concern? `src/interface`.
4. Concrete adapter or runtime wiring? `src/infra`.
5. Pure cross-layer utility? `src/shared`.

See `eslint.config.mjs` for enforced import boundaries.

For service extraction and transaction ownership, follow
[Service Ownership](service-ownership.md).
