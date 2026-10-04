# Archive Counterparties Plan

## Goal

Expose the specific endpoint `POST /counterparties/:id/archive` to archive the
identified counterparty in the active accounting entity, record the transition
in history, and return its updated DTO. This plan covers archiving only; it does
not authorize implementation.

**Status: implementation-ready.** Preserve unrelated staged and working-tree
changes, including existing changes in `src/interface/mcp/tools/index.ts` and
`package.json`.

## Implementation Status

Preflight completed: current entity, repository, mutation policy, controller,
and IoC match the plan. Baseline has only untracked `.agents/plans/`; source
and generated files are clean. No deviation is required.

| Slice                                 | Owner and basis                                                          | Intended files/tests                                 | Status                                                                                                |
| ------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Archive input contract                | App; DTO rules and journal-entry archive DTO precedent                   | Archive DTO, validator, DTO tests                    | Implemented; focused DTO tests passed                                                                 |
| Archive transition, event, audit      | Domain; entity rules and existing counterparty transitions               | Entity, event/action definitions, entity/audit tests | Implemented; entity/audit tests passed                                                                |
| Archive workflow and persistence      | App; mutation policy, repository atomic update, journal archive use case | Archive use case and component specs                 | Implemented; focused component specs passed                                                           |
| HTTP delivery and wiring              | Interface/infra; counterparty middleware and traced IoC precedent        | Controller, IoC, generated routes/spec, HTTP specs   | Implemented; generation and contract inspection passed; HTTP execution unavailable                    |
| Atomicity and regression verification | Tests; existing counterparty DB fixtures and testing rules               | Archive DB specs, focused/regression/static checks   | Specs added; 448 runnable regression tests and static checks passed; PostgreSQL execution unavailable |

### Verification And Reconciliation

- User-approved correction: repeat archive requests return HTTP 200 with the
  existing DTO, including retries with the original valid `expectedVersion`.
  The entity returns `[counterparty, [], null]` for an already Archived source.
  The use case checks tenant visibility before returning an Archived record,
  and performs no new transition, history, write, or publication in that branch.
  Version checks still protect requests that would change a non-Archived record.
  This correction follows the user's explicit instruction and the unchanged
  tuple precedent in `journalLineEntity.update`. The corrected entity/use-case
  behavior passes 450 counterparty regression tests with 100% statement, branch,
  function, and line coverage for the changed entity and use case. HTTP/DB specs
  were updated and type-checked; their previously reported runtime limits remain.
- The initial implementation matched the original plan. The endpoint, strict version-only input,
  pure archive transition, archive event/action, scoped use case, trusted history,
  traced wiring, and generated route/spec match the governing plan.
- Focused domain/DTO/use-case checks: 4 suites, 71 tests passed.
- Counterparty domain/app/repository regression: 25 suites, 448 tests passed.
  Entity, event, archive validator, and archive use-case coverage are 100% for
  statements, branches, functions, and lines.
- Source/test type checking, `npm run build:routes`, `npm run lint`,
  `npm run test:names`, and diff whitespace checks passed.
- HTTP specs were added and type-checked, but execution cannot proceed in this
  sandbox: Supertest's local listener fails with `EPERM`, including on loopback.
  Existing HTTP regression suites share this listener requirement.
- PostgreSQL specs were added and type-checked, but execution cannot proceed:
  the test environment has no `POSTGRES_URL` for a migrated disposable `_test`
  database. No database was created, reset, migrated, or accessed.
- Production changes are confined to the planned counterparty files and
  generated route/spec; no restore/delete/MCP/UI/read/filter behavior changed.
  Unrelated formatting changes to `src/infra/config/drizzle/schema.ts` and
  `relations.ts` appeared concurrently in the shared workspace and were not
  modified by this implementation.

## Context

The counterparty domain already defines Draft, Active, and Archived statuses, but
there is no archive entity operation, use case, or HTTP endpoint. Ordinary PATCH
updates allow details changes and Draft activation; they reject Archived targets
and ordinary updates to Archived records. Archiving needs a dedicated transition
rather than widening PATCH.

The nearest archive precedent is
`src/interface/http/controllers/journal-entry.controller.ts::archiveJournalEntry`
and `src/app/journal-entry/usecases/archive-journal-entry.usecase.ts`. Reuse its
delivery and workflow shape while retaining counterparty-specific ownership,
validation, repository scoping, and output mapping.

## Domain Language And Existing Guarantees

- **Authoritative state:** `core.counterparties.status` and `version`, mapped to
  `ICounterparty` in `src/domain/counterparty/types/counterparty.types.ts`.
  `roles` is derived from `meta`; archiving must preserve both.
- **Domain terms:** Use `Archived`, `archive`, `expectedVersion`, accounting
  entity, actor, audit, and history. Archiving changes status without deleting
  the counterparty or its references.
- **Concurrency:** `counterpartyMutationPolicy.validate` rejects stale client
  versions. `ICounterpartyRepo.update` checks the database row's ID, accounting
  entity, and expected version. `validateVersionInRepo` requires the entity and
  history versions to equal `expectedVersion + 1`.
- **Atomicity:** `counterpartyRepo.update` already saves the row and its history
  in one repository-owned transaction. A failed history write rolls back the
  row update. No outer transaction or preparation lock is required for a single
  status transition protected by the existing conditional update.
- **Publication:** Existing mutation use cases await event publication after
  persistence. Publication is not atomic with the database write; retain that
  failure behavior without adding an outbox or retry mechanism.

## Confirmed Findings

1. **Storage already supports archiving.**
   `db/migrations/0033_counterparties.ts` and
   `src/infra/config/drizzle/schema.ts::counterPartyStatusInCore` include
   `archived`. Counterparty history stores `action` as varchar. No database
   migration is needed for an `archived` action.
2. **The domain transition is missing.**
   `counterpartyEntity` exposes `make`, `addRole`, and `update` only.
   `ECounterpartyEvents` and `ECounterpartyEntityActions` have no archive member.
   `counterpartyError.Archived` already maps to HTTP 409 for ordinary updates;
   the archive endpoint instead returns the existing record on repeat requests.
3. **Existing boundaries can be reused.**
   `CounterpartyController` uses authentication, Alpha 1 access, and accounting
   entity access middleware. `counterpartyMutationPolicy.validate` hides missing
   or foreign-accounting-entity records before checking versions, and
   `counterpartyDtoMapper.toDto` already represents Archived responses.
4. **The update lock has a different purpose.**
   `makeUpdateCounterpartyUsecase` locks the parent row for the domain service's
   transaction-usage check on type changes. Archiving changes no type or journal
   associations and needs no usage read. Neither the domain service nor the
   application `findOrCreate` service needs an archive method.
5. **The standalone permission declaration is unused.**
   `src/domain/counterparty/policies/counterparty.policy.ts::counterpartyResource`
   has no production callers. Extend the controller's current middleware path;
   do not introduce a permission-system change for this endpoint.

## Implementation Basis

| Decision or structural change                                       | Basis                                   | Current requirement and production consumer                                          | Evidence or rationale                                                                                                |
| ------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------- |
| Dedicated POST archive route and strict version-only input          | Requirement and precedent               | Expose single-counterparty archiving to authenticated API callers                    | `JournalEntryController.archiveJournalEntry`; `IJournalEntryArchiveReq` and `journalEntryArchiveReqValidation`       |
| Pure `counterpartyEntity.archive` returning state, event, and audit | Rule and precedent                      | Prepare the archive transition for the archive use case                              | Folder Responsibility; `counterpartyEntity.update`; `journalEntryEntity.archive`                                     |
| Add archive event and audit action                                  | Rule and precedent                      | Describe the actual transition produced and persisted by the archive use case        | CONTRIBUTING event/immutability requirements; `counterpartyEvents.activated`; `ECounterpartyEntityActions.Activated` |
| Use case initiates the existing conditional update with history     | Rule and precedent                      | Persist the archive atomically for the archive endpoint                              | Service Ownership; `makeArchiveJournalEntryUsecase`; `counterpartyRepo.update`                                       |
| Reuse mutation policy and response mapper                           | Precedent                               | Protect tenant/version boundaries and return the archive response                    | `makeUpdateCounterpartyUsecase`; `counterpartyMutationPolicy.validate`; `counterpartyDtoMapper.toDto`                |
| Add traced use-case wiring to existing counterparty IoC             | Rule and precedent                      | Construct the controller's archive executor                                          | IoC rules; `src/infra/ioc/usecases/counterparty.ts::updateCounterpartyUseCase`                                       |
| Return HTTP 200 for already Archived records                        | Explicit user requirement and precedent | Make archive retries return the existing record without writes, histories, or events | User's repeat-archive correction; `journalLineEntity.update` returns unchanged state, empty events, and null audit   |

No architectural deviation or new service is proposed. The endpoint performs
one archive operation on the addressed counterparty.

## Scope

### Expected Changes

- `src/domain/counterparty/entities/counterparty.entity.ts` — add the pure archive
  transition and expose it on the existing entity object.
- `src/domain/counterparty/events/counterparty.events.ts` — add `Archived` with
  value `domain:counterparty:archived` and an `archived` event factory.
- `src/domain/counterparty/types/counterparty-audit.types.ts` — add the
  `Archived: 'archived'` audit action.
- `src/app/counterparty/dtos/counterparty-archive/counterparty-archive.dto.ts` and
  `counterparty-archive.dto.validation.ts` — define and validate
  `ICounterpartyArchiveReq` with required `expectedVersion` only.
- `src/app/counterparty/usecases/archive-counterparty.usecase.ts` — own the
  request workflow, history attribution, persistence, and event publication.
- `src/infra/ioc/usecases/counterparty.ts` — export `archiveCounterpartyUseCase`
  through the existing tracing wrapper and inject existing dependencies.
- `src/interface/http/controllers/counterparty.controller.ts` — add the route,
  operation metadata, middleware, and app DTO response declaration.
- Tests identified below, plus generated routes/spec from `npm run build:routes`.

### Out of Scope

- Restore/unarchive, delete, bulk archive, activation changes, and other edits.
- Frontend changes, MCP tools, new event subscribers, and archive notifications.
- List defaults, search/filter changes, hiding archived records from existing
  reads, and counterparty history endpoints.
- Changes to journal entries, ledger accounts, balances, transaction eligibility,
  or prevention of future references to Archived counterparties.
- New services, repository APIs, permission systems, locks, retry mechanisms,
  outboxes, feature flags, configuration, schema changes, and migrations.
- Refactoring or renaming existing validators, policies, mocks, or unrelated code.

## Proposed Approach

### 1. Define the archive API contract

- Endpoint: `POST /counterparties/:id/archive`, operation ID `archiveCounterparty`.
  Declare it as `@Post('/{id}/archive')` on `CounterpartyController`, following
  TSOA path syntax. The existing `/api/v1` base path applies at runtime.
- Request body: `{ "expectedVersion": 1 }`, using the version from the client's
  last read. Require a positive integer and reject extra fields. Use existing
  counterparty error keys in validation messages; accept no mutable details,
  status selector, tenant ID, or actor ID in the body.
- Return HTTP 200 with the existing `ICounterpartyDto` and updated status,
  version, and timestamp for a new archive. Return the unchanged DTO when the
  scoped record is already Archived, including a retry with the original version.
- Document existing error envelopes: 400 malformed ID, 401 unauthenticated,
  403 denied feature/accounting access, 404 missing or foreign counterparty,
  409 stale version on a non-Archived record or a concurrent write conflict, 422 invalid body, and 500 unexpected
  failure. Do not change shared error handling.
- Apply the same three middlewares as the other counterparty endpoints. The
  controller only forwards the path and body to the wired use case.

### 2. Add the domain-owned archive transition

- Add `archive(counterparty)` to `counterpartyEntity`, returning the existing
  audited tuple with a nullable audit, following `journalLineEntity.update`.
  Validate the input entity and archive a non-Archived counterparty (Draft or
  Active). For an already Archived record return `[counterparty, [], null]`,
  preserving object identity, version, and timestamps.
- Construct the next state field by field and deeply freeze it. Change only
  `status` to Archived, `version` by exactly +1, and `updatedAt` to the transition
  timestamp. Preserve identity, accounting entity, creator, creation timestamp,
  name, type, roles, and metadata.
- Return exactly one archive event carrying the resulting counterparty and one
  audit using `counterpartyAuditValue.make`, with the `archived` action and the
  same resulting version/timestamp. Keep the prior entity unchanged.
- Do not call the general update operation, widen its status validation, or add
  a domain/app service wrapper around this entity transition.

### 3. Orchestrate and persist through the use case

Implement `makeArchiveCounterpartyUsecase` with existing `IAppContext`,
`ICounterpartyRepo`, and `IEventBus` dependencies:

1. Validate UUID and body before reading context or repositories.
2. Get the trusted actor, active accounting entity, correlation ID, and
   idempotency key from app context, following counterparty mutation conventions.
3. Read through `counterpartyRepo.findById(id, accountingEntity.id, readOptions)`
   without a lock or caller-owned transaction.
4. Reject missing/foreign records before checking status. If `existing.status`
   is Archived, immediately return its mapped DTO without checking the stale
   client version, invoking the entity, writing history, or publishing an event.
   Otherwise apply `counterpartyMutationPolicy.validate` for `expectedVersion`,
   then call `counterpartyEntity.archive`. This path always produces an audit.
5. Prepare history through `historyValue.make(audit, actor.id, correlationId)`.
6. Initiate the sole write directly from this use case:
   `counterpartyRepo.update(archivedCounterparty, { correlationId, expectedVersion: payload.expectedVersion, history })`. Reuse its existing
   internal transaction and conditional update; do not save history separately.
7. After the update resolves, enrich and publish the event using the existing
   correlation/idempotency context, then return `counterpartyDtoMapper.toDto`.

A failed read, validation, transition, or write produces no publication. A
concurrent writer winning after the read produces the existing repository
version conflict. A publication failure propagates after the archive/history
have committed, matching existing behavior.

### 4. Wire and generate delivery artifacts

Construct the archive executor in the existing counterparty IoC module with
`appContext`, `counterpartyRepos.counterparty`, and `messaging.eventBus`. Wrap it
with `makeTracedUseCase('counterparty.archiveCounterpartyUseCase', ...)`.
Import it in the controller and regenerate TSOA routes/spec. Do not hand-edit
generated artifacts or introduce new logger/reporter events.

## Test Plan

- **Domain unit:** Extend
  `src/domain/counterparty/entities/__tests__/counterparty.entity.test.ts` to
  cover archiving Draft and Active records, an unchanged repeat archive with
  empty events and null audit, invalid entity,
  preserved fields, immutability, +1 version, timestamp, one archive event, and
  audit diff/action. Extend
  `src/domain/counterparty/values/__tests__/counterparty-audit.vo.test.ts` for the
  accepted archive action. Cover event creation through the entity's public API.
- **DTO unit:** Add
  `src/app/counterparty/dtos/counterparty-archive/__tests__/counterparty-archive.dto.validation.test.ts`
  for valid versions, missing/null/non-number/non-positive/fractional versions,
  invalid body shapes, and extra fields.
- **Use-case component:** Add
  `src/app/counterparty/usecases/__specs__/archive-counterparty.usecase.spec.ts`.
  Use existing shared context/repository/event-bus mocks and the real entity
  transition. Verify scoped reads, hidden foreign resources, version checks,
  trusted actor history, one atomic write, publication ordering, DTO mapping,
  and read/write/publication failures. No event or write on rejected requests.
  Already Archived records return the unchanged DTO with both current and stale
  valid versions, without invoking the entity or write/publication boundaries.
- **HTTP integration:** Add
  `test/http/counterparty/archive-counterparty.post.spec.ts`, grouped by response
  status. Exercise Supertest, real middleware and the archive workflow with
  external boundaries mocked, following the counterparty PATCH spec. Cover
  success, body/ID errors, authentication, feature/accounting access, missing or
  foreign record, stale versions, repeat archive, persistence conflict, and
  sanitized failure. Verify dates serialize and forged actor input cannot
  control history attribution.
- **Database integration:** Add
  `test/db/counterparty/archive-counterparty.db.spec.ts` using the existing
  disposable database fixture/cleanup conventions. Prove archived state and
  one attributed history commit together; history failure rolls both back;
  stale and competing writes cannot overwrite the winner or add extra history.
  Verify publication failure leaves the committed archive/history intact.
- **Regression:** Run existing counterparty domain, DTO, use-case, repository,
  and HTTP suites. Ordinary PATCH must still reject `status: 'archived'` and
  updates to Archived records. Existing reads and filters retain their behavior.
  Keep touched behavior coverage at 100%; no frontend/browser tests are needed.

## Verification

Run these during implementation, starting with focused checks:

```bash
npm test -- --runInBand --runTestsByPath src/domain/counterparty/entities/__tests__/counterparty.entity.test.ts src/domain/counterparty/values/__tests__/counterparty-audit.vo.test.ts src/app/counterparty/dtos/counterparty-archive/__tests__/counterparty-archive.dto.validation.test.ts src/app/counterparty/usecases/__specs__/archive-counterparty.usecase.spec.ts
npm run build:routes
npm test -- --runInBand test/http/counterparty src/domain/counterparty src/app/counterparty src/infra/persistence/repos/counterparty
npm test -- --config jest.db.config.js --runInBand --runTestsByPath test/db/counterparty/archive-counterparty.db.spec.ts
npm run lint
npm run test:names
```

`npm test` runs the source/test type check through its pretest script. Inspect
the generated route and OpenAPI contract for the endpoint, request strictness,
and response DTO. The database suite requires the existing environment config
and a migrated disposable PostgreSQL database ending in `_test`; follow
`test/db/README.md`. Do not reset or migrate a non-test database.

These are future implementation checks. No application tests or generation are
required for creating this plan alone.

## Risks

- **Concurrent updates:** An archive prepared from a stale record could overwrite
  newer details without version enforcement. Retain both the app policy check
  and the database conditional update; verify the losing archive writes no history.
- **Post-commit publication failure:** An HTTP failure can occur after the record
  is archived. Keep the existing mutation semantics and test the committed state;
  event delivery guarantees are outside this plan's scope.

## Completion Criteria

- `POST /counterparties/:id/archive` archives the identified non-Archived
  counterparty with valid `expectedVersion`, authentication, and accounting
  entity access, and returns the existing DTO.
- Only status, version, and update timestamp change; each success persists one
  matching archive history and publishes one archive event after persistence
  when a transition occurs. Repeat requests return HTTP 200 with the unchanged
  DTO, version, and timestamps and produce no new history, write, or event.
- Rejected requests and failed atomic writes change no counterparty/history and
  publish no event; concurrent writes retain the existing conflict protection.
- Required focused, regression, generation, static, and database checks pass,
  with any unavailable database verification explicitly reported.
- No restore, delete, bulk, frontend, MCP, list/filter, transaction-rule, schema,
  or unrelated behavior is changed.
