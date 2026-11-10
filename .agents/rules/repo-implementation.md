# Repository Implementation

Repositories are storage adapters. Keep them boring.

## Rules

- One table gets one repository unless an aggregate must be persisted atomically.
- Methods receive and return domain/app contract types, not Drizzle types.
- Use explicit mappers for persistence shape changes.
- Use `getDbQueryHelper(options)` so callers can pass transactions.
- Add a matching mock under `src/infra/persistence/repos/**/__mocks__`.
- Do not use `any`.

## Never Put In Repos

- Business rules.
- Application policy.
- Workflow orchestration.
- Event publishing.
- Emails, queues, HTTP calls, cache side effects, or service calls.
- Convenience methods that combine use-case steps.

Keep workflow-specific coordination and transaction ordering in the owning use
case. Extract a service only when the coordination is an independently reusable
capability. Follow [Service Ownership](service-ownership.md).
