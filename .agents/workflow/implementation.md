# Implementation Workflow

Use this for ordinary code changes.

1. Read the relevant skill, rule, and workflow files completely.
2. Inspect nearby entities, services, contracts, mocks, tests, repositories, and
   IoC before adding files or abstractions. Read the owning domain documentation
   and reuse its vocabulary.
3. Identify the requirement, durable rule, concrete local precedent, or approved
   deviation supporting each structural decision and name its current production
   consumer. Record the authoritative state, consistency expectation, and
   existing concurrency or uniqueness guarantees before adding coordination.
   Follow [Scope And Simplicity](../rules/scope-and-simplicity.md) and [Precedent
   And Deviation](../rules/precedent-and-deviation.md).
4. Revalidate any saved plan against durable rules and the current repository.
   Plans do not override current rules or established local patterns.
5. Name the owner of every invariant, decision, side effect, transaction, and
   new behavior: domain, app, interface, infra, or shared.
   For every write, verify that a use case initiates it. A dedicated persistence
   service may compose the repository writes, but no domain or
   non-persistence application service may invoke that capability.
6. Before editing, run the ownership checks that match the change:
   - For HTTP outputs, search for an existing app DTO and mapper before adding
     response contracts or exposing domain entities.
   - For reusable failure behavior, inspect every caller before assigning
     rejection, best-effort handling, or reporting ownership.
   - For transactions, review callback shape separately for responsibility
     creep, separate preparation reads from atomic writes, name preparation
     versus persistence phases, and verify the use case invokes every write or
     persistence service. Verify cleanup ownership against
     [Transaction Lifecycle](../rules/usecase.md#lifecycle-and-cleanup-ownership)
     before adding explicit disposal.
   - For owner APIs, reject expansions that only re-export another helper for
     call-site convenience.
7. Justify each proposed service as a named capability. If it only shortens a
   use case, do not extract it.
8. Keep orchestration, policy, mapping, persistence, and delivery concerns
   distinct without forcing each concern into a separate service.
9. Make the smallest coherent change and follow nearby readability patterns.
10. Validate new imports against [Import Paths](../rules/import-paths.md).
11. Add or update tests at the owning layer.
12. Run focused validation, then broader validation when risk is higher.

Follow [Service Ownership](../rules/service-ownership.md),
[Service Philosophy](../rules/service-philosophy.md),
[Inversion of Control](../rules/ioc.md), and
[Readability](../rules/readability.md) when those concerns are in scope. Follow
[DTOs](../rules/dto.md) and [Mappers](../rules/mapper.md) for HTTP outputs or
cross-layer conversion, and [Use Cases](../rules/usecase.md) for transactions.
