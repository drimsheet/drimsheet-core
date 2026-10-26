# Testing

Reporting specs and query-function mocks follow the exceptions in
[Reporting Use Cases](../reporting-usecases.md).

## General Rules

- All tests in this repository are unit or integration tests that run without
  external platforms. Mock external boundaries or use in-process fakes; never
  require a real PostgreSQL database, Redis, queue, cloud service, or external API.
- Tests must not require platform credentials, connection URLs, containers,
  migrations, or database setup, or skip themselves when those are unavailable.
- Platform-dependent behavior and database execution plans belong in the
  separate E2E suite, not this repository's test suite.
- Keep coverage at 100% for touched behavior.
- Do not use `any`.
- Prefer existing shared mocks from `__mocks__`.
- Do not create ad hoc dependency mocks when a shared mock should exist.
- Clean up temporary agent-created files.
- Run the narrowest useful test first, then broader validation when risk
  justifies it.

## Shared Mocks

- Shared `*.mock.ts` files define typed contract shapes with bare `jest.fn()`
  methods only.
- Do not put implementations, internal state, fixtures, default return values,
  or default resolved or rejected values in shared mocks.
- Reset shared mocks and configure their behavior in the owning spec's setup or
  in the individual test that needs it.
- Keep stateful or behaviorally realistic test doubles local to the owning spec;
  they are fakes, not shared mocks.

## Domain Contract Mocks

- To avoid duplicate test maintenance, domain repository and domain-service contracts have shared mocks centralized in their corresponding app feature folder under `src/app/<feature>/contracts/__mocks__/`.
- Repository mocks are aggregated in `repos.mocks.ts` (e.g., `src/app/accounting/contracts/__mocks__/repos.mocks.ts`), and domain service mocks are placed in `domain.services.mock.ts`.
- Declare each mock as a named export typed using `jest.Mocked<IContract>`, with every interface method defined as a bare `jest.fn()`.
- **Layer Boundary constraint:** Application, interface, and infrastructure tests MUST use these centralized mocks instead of composing them locally. Domain tests (under `src/domain/**/__tests__`) MUST NOT import app-layer mocks (enforced by `eslint.config.mjs`) and must continue to compose their mocks locally.

## Naming

- Domain unit tests use `.test.ts` files inside `__tests__`.
- Dependency-free DTO and mapper unit tests use `.test.ts` files inside
  `__tests__`, regardless of layer.
- Other dependency-free tests under `src/shared/**` use `.test.ts` files inside
  `__tests__`.
- Other tests outside the domain layer use `.spec.ts` files inside `__specs__`.
- Do not use singular `__test__` or `__spec__` directories.
- HTTP integration specs follow
  [HTTP Integration](http-integration.md#file-naming).
