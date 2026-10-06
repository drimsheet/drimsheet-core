# 9. Architecture Decisions

Important, expensive, large scale or risky architecture decisions including rationales, also known as Architectural Decision Records (ADRs).

> [!WARNING]
> **Do not create, rename, or delete ADR files manually.**
> To maintain strict sequential numbering and automatically synchronize this table, you MUST use the integrated CLI scripts:
>
> - **To Add:** Run `npm run adr:add "<Title>"`
> - **To Remove:** Run `npm run adr:remove <serial_number>` (e.g., `npm run adr:remove 0005`)
> - **To Rename:** Run `npm run adr:rename <serial_number> "<New Title>"`

The following architectural decision records (ADRs) capture the critical technical choices that shape the structural integrity, security, and scalability of Drimsheet.

| ID                                                                             | Title                                                    | Status                 |
| ------------------------------------------------------------------------------ | -------------------------------------------------------- | ---------------------- |
| [ADR-0001](./adrs/0001-modular-monolith-architecture.md)                       | Modular Monolith Architecture                            | Accepted               |
| [ADR-0002](./adrs/0002-integer-based-financial-computations.md)                | Integer-Based Financial Computations                     | Accepted               |
| [ADR-0003](./adrs/0003-append-only-database-pattern.md)                        | Append-Only Database Pattern for Financial Records       | Accepted               |
| [ADR-0004](./adrs/0004-drizzle-orm-over-prisma.md)                             | Drizzle ORM for Queries & node-pg-migrate for Migrations | Accepted               |
| [ADR-0005](./adrs/0005-decoupling-tax-versioning.md)                           | Decoupling Tax Versioning from Core Ledgers              | Accepted               |
| [ADR-0006](./adrs/0006-self-hosted-coolify-infrastructure.md)                  | Self-Hosted Infrastructure via Coolify                   | Accepted               |
| [ADR-0007](./adrs/0007-exposing-mcp-interface.md)                              | Exposing Core Logic via the Model Context Protocol (MCP) | Accepted               |
| [ADR-0008](./adrs/0008-dynamic-secrets-via-doppler.md)                         | Dynamic Secrets Injection via Doppler                    | Accepted               |
| [ADR-0009](./adrs/0009-controlled-currency-system.md)                          | Controlled Currency System                               | Accepted               |
| [ADR-0010](./adrs/0010-system-bound-category-taxonomy.md)                      | System-Bound Category Taxonomy                           | Accepted               |
| [ADR-0011](./adrs/0011-automated-adr-management.md)                            | Automated ADR Management                                 | Accepted               |
| [ADR-0012](./adrs/0012-relational-contra-adjunct-accounts.md)                  | Relational Contra & Adjunct Accounts                     | Accepted               |
| [ADR-0013](./adrs/0013-optimistic-concurrency-control.md)                      | Optimistic Concurrency Control                           | Superseded by ADR 0019 |
| [ADR-0014](./adrs/0014-first-class-observability-metrics.md)                   | First-Class Observability Metrics                        | Superseded by ADR 0016 |
| [ADR-0015](./adrs/0015-transactional-outbox-for-ledger-balance-propagation.md) | Transactional outbox for ledger balance propagation      | Accepted               |
| [ADR-0016](./adrs/0016-direct-better-stack-observability.md)                   | Direct Better Stack Observability                        | Accepted               |
| [ADR-0017](./adrs/0017-infrastructure-integration-adapters.md)                 | Infrastructure Integration Adapters                      | Accepted               |
| [ADR-0018](./adrs/0018-first-class-domain-validations.md)                      | First-Class Domain Validations                           | Accepted               |
| [ADR-0019](./adrs/0019-internal-concurrency-tokens.md)                         | Internal Concurrency Tokens                              | Accepted               |
