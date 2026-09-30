# Contributing to Drimsheet

This document provides guidelines for contributing to this project to ensure a smooth workflow and high-quality code.

## Table of Contents

- [Contributing to Drimsheet](#contributing-to-drimsheet)
  - [Table of Contents](#table-of-contents)
  - [Design Pattern](#design-pattern)
    - [Pragmatic Functional OOP](#pragmatic-functional-oop)
    - [Event-Driven Pattern and Immutability](#event-driven-pattern-and-immutability)
    - [Folder Structure](#folder-structure)
  - [Domain Documentation](#domain-documentation)
  - [Working with Money](#working-with-money)
  - [Git Workflow](#git-workflow)
    - [Branching Strategy](#branching-strategy)
    - [Feature Branches](#feature-branches)
    - [Commit Messages \& Pull Requests](#commit-messages--pull-requests)
  - [Testing](#testing)
  - [Reporting Bugs](#reporting-bugs)

## Design Pattern

### Pragmatic Functional OOP

- Domain entities, values, and pure rules should avoid side effects.
  Use cases alone initiate persistence and own workflow write ordering.
  Application services return prepared results and must not invoke write
  repositories or persistence services. When multiple repository writes must
  remain atomic, a dedicated persistence service may compose them, but only a
  use case may invoke that persistence capability.
- Services should represent named capabilities with clear ownership. See
  [Service Philosophy](.agents/rules/service-philosophy.md) and
  [Service Ownership](.agents/rules/service-ownership.md).
- All similar functions are grouped in an immutable object. Domain validation
  objects and one-function helper modules follow
  [Domain Validations And Helpers](.agents/rules/domain-validations.md).
- Function/Methods do not call external services directly. Dependencies are wired up in `index.ts` of each feature or sub-layer.\
  for example, `src/app/bookkeeping/usecases/index.ts` or `src/infra/services/index.ts`.

### Event-Driven Pattern and Immutability

- Domain entity creations or mutations MUST return both the new entity state and any corresponding domain events (e.g., `return [entity, events]`).
- Domain publishing is done on the application layer.

- **Strong Immutability**: All domain entities and state objects MUST be deeply frozen (e.g., using `deepFreeze()`) to prevent accidental mutations.\
  See `src/domain/journal-entry/entities/journal-entry.entity.ts` or `src/domain/ledger/entities/shared/ledger-account.entity.ts` for reference.

### Folder Structure

For the folder structure, we have favored Domain Driven Design.

> For a deeper architectural understanding of how these layers interact and the dependency rules between them, please read **[Section 5: Building Block View](docs/05_building_block_view.md)**.

Here are the top level folders you would find on the application:

```text

src/
├─ app/                 # Application layer: orchestrates use-cases, handles commands, maps data between domain and external interfaces
│  ├─ _bootstrap/       # Application bootstrap logic and server initialization
│  ├─ _internal/        # Internal-only application use cases
│  ├─ accounting/       # Accounting feature: dtos, handlers, mappers, use cases
│  ├─ auth/             # Authentication feature: contracts, dtos, errors, mappers, use cases
│  ├─ bookkeeping/      # Bookkeeping feature: contracts, dtos, handlers, mappers, use cases, workers
│  ├─ currency/         # Currency feature: contracts, mappers, use cases, workers
│  ├─ ledger/           # Ledger feature: dtos, errors, handlers, mappers, use cases
│  ├─ notification/     # Notification feature: contracts, dtos, workers
│  ├─ shared/           # App-layer shared context, contracts, dtos, errors, helpers, and mappers
│  └─ user/             # User feature: dtos, handlers, mappers, use cases
│
├─ domain/              # Domain layer: core business logic, entities, repo interfaces and rules
│  ├─ accounting/
│  ├─ bookkeeping/
│  ├─ currency/
│  ├─ journal-entry/
│  ├─ ledger/
│  ├─ subledger/
│  └─ user/
│
├─ infra/               # Technical layer: implementations of services, database, and infrastructure concerns
│  ├─ config/           # Application and environment configuration, including secrets and runtime settings
│  ├─ db/               # Database migrations (node-pg-migrate)
│  ├─ integrations/     # Named external-platform adapters implementing or translating into system-owned boundaries
│  ├─ messaging/        # Domain event bus and BullMQ queues/workers
│  ├─ observability/    # Logging, metrics, monitoring, and tracing
│  ├─ persistence/      # Data persistence mechanisms including DB (Drizzle), caching, and concrete repo implementations
│  ├─ server/           # Express (or other HTTP) server setup and bootstrapping
│  ├─ services/         # Concrete infrastructure capabilities that are not named platform integrations
│  └─ templates/        # Email templates (MJML source and compiled TypeScript)
│
├─ interface/           # Application entry points and external interfaces
│  ├─ http/             # API REST endpoints, controllers, handlers, and middlewares
│  └─ mcp/              # MCP (Model Context Protocol) endpoints
│
└─ shared/              # Shared utilities and types used across multiple layers
   ├─ __docs__/         # Shared documentation covering concepts like monetary values
   ├─ errors/           # Shared domain/application error types
   ├─ types/            # Global TypeScript types and interfaces
   ├─ utils/            # Helper functions, constants, and reusable utilities
   └─ value-objects/    # Shared value objects and related entities

```

## Domain Documentation

Contributors should see further documentations in the `__docs__` folder within the `domain` layer for the respective domains.

## Working with Money

- **Always use minor units**: Never use fractional values for money.
- **Use the Value Object**: Always run calculations through `moneyValue` (`src/shared/value-objects/money.vo.ts`).

For detailed documentation and examples on handling currency, see [`src/shared/__docs__/money.md`](src/shared/__docs__/money.md).

## Git Workflow

To maintain a clean and organized codebase, please follow these strict git workflow guidelines.

### Branching Strategy

- **`development`**: This is the main branch for development. All contributor Pull Requests (PRs) should be merged into `development`.
- **`main`**: This is the prerelease branch. Prerelease Pull Requests merge `development` into `main`, which deploys to staging for integration testing.
- **`release`**: This is the production branch. After this repository's prerelease succeeds, the approved `main` changes are promoted to `release`, which deploys to production.

### Feature Branches

- **Source**: Every new branch must be created off the `development` branch.
- **Target**: Every update must be submitted as a PR to the `development` branch.
- **Prerelease**: Open a PR from `development` to `main` after the contributor changes are ready for staging.
- **Release**: After the prerelease succeeds, promote the approved `main` changes to `release` through a PR.
- **Naming Convention**:
  - Branches should be named using the format: `<type>/<optional-issue-id>/<description-with-hyphens>`
  - **Types**: `feat`, `fix`, `chore`, `refactor`, `test`, `doc`
  - **Examples**:
    - `feat/49494/add-accounts-endpoint`
    - `fix/49494/login-error`

### Commit Messages & Pull Requests

We enforce a specific commit message format to generate clean changelogs and track history effectively.

- **Format**:
  ```text
  <type>(<domain>): <short description> <optional-id>
  ```
- **Rules**:
  - Pull request titles should also have the commit message structure.
  - PRs must be squashed and merged.
- **Examples**:
  - `feat(accounts): add endpoint to create account 3442`
  - `test(auth): improves smoke test`

## Testing

`npm test` type-checks source and tests once, then runs Jest with at most two
workers. Jest uses `tsconfig.jest.json` for per-file transpilation; semantic type
checking uses `tsconfig.test.json` through `npm run test:types`. When invoking
Jest directly, run the type check separately, as CI does before its coverage
jobs.

The Jest setup shuts down real rate-limit memory stores after each suite so
their recurring timers cannot retain completed test environments. Tests still
exercise the real rate-limit implementation.

Our project follows these guidelines for testing:

- **Test Proximity**: Test files should be kept near their test subjects.
- **Dependency-free tests**: Domain tests, DTO tests, mapper tests, and `src/shared/**` tests use nearby `__tests__` folders with `.test.ts` files.
- **Dependency-bearing tests**: Other application, infrastructure, and interface tests use nearby `__specs__` folders with `.spec.ts` files.
- **Directory names**: Use plural test folders only: `__tests__` and `__specs__`.
- **End-to-End (E2E) Tests**: All E2E testing is handled in the frontend repository.

## Reporting Bugs

If you find a bug, please create a ticket for it on our [GitHub Issues page](https://github.com/Drimsheet/drimsheet-core/issues).
Before opening a new issue, please search existing issues to see if it has already been reported.

- **Requirement**: Every bug report must have a corresponding ticket.
- **Format**: The ticket must clearly specify:
  1.  **Expected Behaviour**: What should happen.
  2.  **Current Behaviour**: What is actually happening.
