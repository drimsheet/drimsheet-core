# Enforce Counterparty Type After Transaction Use Plan

## Approved Repository Ownership Correction

The user requested replacing `counterpartyRepo.hasTransactionReferences` with
`journalLineRepo.findAllByCounterpartyId`. Journal-line retrieval belongs to the
journal-line repository; the domain service decides whether usage prohibits a
type change. Return a plain array from a simple lookup, with no search, sorting,
pagination or count query. Scope through the journal accounting entity
and include every status. Honor `options.lock` on returned journal-line rows.
Keep the existing `ERepoLock.Update` on the counterparty lookup: it protects
first association even when no matching journal lines exist. The workflow uses
the same transaction for both reads and does not require an additional child-row
lock. This approved correction supersedes the former existence-query ownership
and the earlier unnecessary paginated contract. The ownership correction is implemented
and verified; the unrelated null-metadata creation edit remains preserved.

## Implementation Status

Repository simplification (complete): the user rejected search/query features
on `findAllByCounterpartyId`. Use `IReadRepoOptions` and return `IJournalLine[]`
from one scoped query, retaining optional locking. Update the validator and
tests to consume arrays; leave the existing account query outside this change.
Verification: 179 focused tests passed with 100% coverage for the journal-line
repository and counterparty service validator; the existing null-metadata
creation test remains the sole failure. All 29 PostgreSQL and 36 PATCH tests
passed, including scoped references, archived entries and locking. Test/build
type checks, lint/import policy, test naming and whitespace checks passed.

Approved metadata-helper extraction (complete): derive optional replacement
metadata in `services/helpers/get-updated-counterparty-meta.helper.ts`, with one
default-exported `getUpdatedCounterpartyMetaHelper` function and colocated tests.
Pass only the requested metadata. Preserve omitted/empty semantics, role value
construction and address-error translation; import the helper directly in the
service without re-exporting it.
Verification: 107 focused tests passed, including all 11 helper tests; the
existing null-metadata creation expectation remains the sole failure. The
helper and service have 100% statement, branch, function and line coverage.
Type checking, full lint/import policy, test naming and whitespace checks pass.

Approved validation extraction (complete): move the transaction-usage lookup
and type-change conflict into the domain-service validation module. The existing
service invokes `validateTypeChangeAllowed` only for an actual type change,
passing trusted IDs and the same read options. The validator returns
`Promise<void>` and receives dedicated domain tests; persistence is unchanged.
Verification: 96 focused tests passed, including the validator and use-case
specs; the previously identified null-metadata creation expectation still
fails. The service and validator have 100% statement, branch, function and line
coverage. Type checking, full lint/import policy, test names and whitespace
checks passed. No creation behavior or staged changes were altered.

Approved default-disposal refinement (complete): successful `commit()` now
disposes unless the caller explicitly supplies `{ dispose: false }`. Updated
the counterparty caller, lifecycle tests and disposal lint rule for that default.
Failed commits still require `handleError` or finally disposal; post-commit
failures must never roll back. Preserve unrelated working changes and the index.
Verification: 46 transaction/use-case tests with 100% coverage for both owning
files, 83 disposal lint tests, 36 PATCH tests and 29 PostgreSQL tests passed.
Test/build type checks, full lint/import policy, formatting and whitespace
checks passed. This supersedes the earlier opt-in disposal default below.

Approved transaction API refinement (complete): add optional
`commit({ dispose: true })` and `handleError(error): Promise<never>` to the
existing manual transaction. Keep explicit commit/dispose callers compatible.
The handler rolls back unfinished work regardless of error origin, releases
once, and rethrows; committed transactions are never rolled back, including
when later event publication fails. Failed/uncertain commits discard the client.
Cleanup failure retains the original and cleanup errors through existing errors.
The counterparty use case keeps its result local to `try`, commits and disposes
before publication, and returns the error handler from `catch` without `finally`
or mutable outer state. Extend the disposal lint rule to accept this pattern
only when successful paths cannot bypass a disposing commit. Scope: transaction
contract/adapter/mock, update use case, lint rule, lifecycle/HTTP/PostgreSQL tests
and ledger.

Latest lifecycle verification: 42 use-case/transaction tests, 36 PATCH tests,
29 PostgreSQL regression tests and 77 disposal lint tests passed. Both the
transaction adapter and update use case have 100% statement, branch, function
and line coverage. PostgreSQL verifies that the update and its audit are visible
to another connection before publication and survive a publication failure.
Test/build type checks, full lint/import policy, test naming, formatting and
diff whitespace checks passed. The full regression passed 4,732 of 4,734 tests:
the preserved creation null-metadata mismatch still fails; an MCP rate-limit
test received 200 instead of 429, but all 15 MCP tests passed on isolated rerun.
The API refinement and lint extension are user-approved; no unrelated behavior
was changed and the staged index was preserved.

Revalidated against current service, repository, manual transaction contract,
IoC, and update tests. The approved repository-ownership correction is now
implemented. The concurrent-update test barrier now precedes the locking read.

| Slice                   | Owner and basis                                          | Files and verification                                             | Status                                                                                                |
| ----------------------- | -------------------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Usage invariant         | Existing domain service; approved current-reference rule | Service, contract, error, typed mocks; domain tests                | Complete; both type directions, omitted/same type, read failures and atomic rejection verified        |
| Storage and transaction | Repository facts; use-case-owned manual transaction      | Repository, use case, IoC; repository, lock SQL, lifecycle tests   | Complete; transaction propagation, lock SQL and failure disposal verified                             |
| Delivery and regression | Existing PATCH contract and audit                        | Controller docs, callers, HTTP tests, generated routes             | Complete; 409 recovery context and allowed edits verified; only Swagger description changes           |
| Database concurrency    | Approved FOR UPDATE / foreign-key coordination           | PostgreSQL usage, rollback, journal preservation, both lock orders | Complete; all 28 PostgreSQL cases passed                                                              |
| Final verification      | Required repository checks                               | Types, naming, lint, build, regression and focused coverage        | Core checks passed; final regression exposed a concurrent creation-semantics edit awaiting resolution |

Verification evidence after the approved ownership correction:

- Focused tests: 552 passed; the existing creation null-metadata test still
  fails because of the concurrent `payload.meta ?? {}` change. Counterparty
  service, update use case, counterparty repository, and journal-line repository
  each have 100% statements, branches, functions, and lines.
- PostgreSQL: all 28 tests pass again, including journal-line lookup with
  `options.lock`, archived references, both FK/parent-lock schedules, rollback,
  deletion/reassignment, and journal history preservation.
- Lock SQL/repository suites: 75 tests passed, including all four lock modes on
  `findAllByCounterpartyId` and rejection when a lock has no transaction.
- Full regression: 4,722 passed out of 4,724. One failure is the preserved
  creation null-metadata change. The other was an unrelated MCP HTTP parse
  error; that complete MCP suite passed on targeted rerun. A preceding combined
  full-suite coverage process exited with code 139; separate focused coverage
  and regression runs completed.
- The original implementation passed 4,713 tests before the concurrent creation
  change. No tests were relaxed to hide that change; its resolution remains
  pending the user's choice.
- `test:types`, `test:names`, lint/import policy, build TypeScript checking,
  and `build:routes` passed. The additional lifecycle waiting assertions passed.
- PostgreSQL verification used the newly provisioned isolated
  `codex_counterparty_20261001_test` database, the existing 48 migrations and
  NGN/NG reference data. No existing database was reset. Drizzle introspection
  output was directed to `/tmp/counterparty-drizzle`, preserving tracked schema.
- Generated route structure was compared with the baseline after normalizing
  object/registration order; no route-contract differences were found. Retained
  the existing generated route ordering and only the changed Swagger operation
  description, avoiding unrelated generation churn.
- No production concurrency TODO was present or added. The service contract now
  documents the caller-held lock. Frontend rendering of the documented recovery
  message remains an external integration requirement, not a verified UI change.

## Goal

Complete counterparty updates by preventing a change of type once the
counterparty has qualifying transaction usage. Continue allowing name and other
currently editable details to change, preserve associated transactions, and
retain atomic counterparty/history persistence. Return an actionable conflict
explaining that a new counterparty is required for a different type.

**Readiness: implementation-ready.** Review comment 1 confirms that only
existing references count, including archived transactions. The user's latest
request supersedes the earlier lock deferral now that manual transactions and
repository lock options exist. Use those capabilities to protect the usage
check through commit, retain optimistic versions, and remove the deferred
concurrency TODO requirement. This updates the plan, not production code.

This is a follow-up to `update-and-activate-counterparty-plan.md`. Preserve that
completed implementation, its optimistic versions, all staged changes, and the
index. This task creates a plan only; it does not implement production changes.

## Pre-implementation Context

- `src/domain/counterparty/services/counterparty.service.ts` already provides
  `makeUpdate`, which normalizes metadata and invokes `counterpartyEntity.update`.
  It has no repository dependencies and does not check transaction usage.
- `src/app/counterparty/usecases/update-counterparty.usecase.ts` performs a
  tenant-scoped read and expected-version check, calls the domain service,
  constructs history, persists the conditional update, then publishes events.
- `src/infra/persistence/repos/counterparty/counterparty.repo.impl.ts` updates
  by ID, accounting entity, and version, saving history in the same transaction.
- `src/infra/ioc/services/counterparty.ts` constructs the existing domain service.
  Extend this seam; do not introduce another update service or endpoint.
- `IRepoService.createTransaction` now returns `IRepoTransaction` with `context`,
  `commit`, and `dispose`. `IReadRepoOptions.lock` accepts `ERepoLock` modes and
  requires a caller-owned transaction. The implemented lock option is on read
  options; writes join through `tx`. Do not invent a second lock-options API.

## Domain Language And Existing Guarantees

- **Type** means `individual` or `organization`. It is independent of the
  employer/vendor/contractor **roles**, which remain derived from metadata.
- **Transaction association** is represented by a journal line's
  `counterpartyId`. All journal source types and statuses count, including Draft,
  Posted, Archived, and retained reversed entries. Do not apply the list UI's
  visibility or status filters to the invariant query.
- **Authoritative state:** current references live in `core.journal_lines`;
  current counterparty type lives in `core.counterparties`. Removed references
  do not count. Deleting the last referenced transaction or removing its last
  reference makes the type editable again, subject to existing validations.
- **Existing guarantees:** counterparty `version`/request `expectedVersion`
  protect competing counterparty updates; the repository atomically commits
  the counterparty and its audit. Journal writes do not increment counterparty
  versions, so the version check alone does not cover concurrent first association.
- **Existing schema:** migration `db/migrations/0038_journal-lines.ts` defines
  a counterparty foreign key and `journal_lines_counterparty_entry_idx` on
  `(counterparty_id, entry_id)`. Reuse that index for an existence query.
- **Concurrency decision:** add a caller-owned manual transaction and acquire
  `ERepoLock.Update` on the counterparty row before the usage query. Keep that
  lock through the conditional update, audit write, and commit. Keep client
  `expectedVersion`; the lock and version check serve distinct purposes.
- **Association coordination:** use the existing journal-line foreign key's
  protection of the referenced counterparty. No new journal write protocol is
  proposed. Verify its interaction with the parent lock using real PostgreSQL
  inserts and reference changes before declaring the race closed.

## Pre-implementation Findings

1. **The missing invariant belongs in the existing domain service.** It is a
   counterparty business decision requiring persisted usage information. The
   current service passes a changed `type` to the entity without checking usage.
2. **Archived references remain available.**
   `makeArchiveJournalEntryUsecase` in
   `src/app/journal-entry/usecases/archive-journal-entry.usecase.ts` updates the
   journal header; it does not remove associated lines. A status-unfiltered
   reference query therefore counts archived transactions.
3. **Historical usage cannot be inferred reliably from current lines or audit
   alone.** `makeDelete` in
   `src/app/journal-entry/services/journal-entry-persistence.service.ts` deletes
   the histories of a never-posted journal before deleting its header; line
   deletion cascades. `makeRectify` can also delete lines or change references.
   The agreed existing-reference rule needs neither historical reconstruction
   nor a separate durable usage record.
4. **The HTTP contract already supports this failure.** The PATCH controller
   declares 409 and returns `IHttpErrorDto`. Counterparty conflict keys map to
   409 using the existing error handler; no new error envelope is needed.
5. **The asynchronous change has bounded production impact.** The update use
   case is the current production caller of `counterpartyService.update`.
   Creation consumers continue to use the synchronous `create` method, but all
   service factory construction sites and relevant test fixtures need the new
   repository dependency.
6. **Counterparty locking still needs wiring.** `counterpartyRepo.findById`
   currently ignores `options.lock`, although its contract accepts
   `IReadRepoOptions`. Follow `accountingEntityRepo.findById` to apply the mode
   explicitly. `getDbQuery` rejects lock-without-transaction requests but does
   not add locking SQL automatically.
7. **There is no deferred concurrency TODO in the current counterparty code.**
   The previous plan required adding it during implementation. Remove that plan
   requirement; if such a comment appears before implementation begins, remove
   it only as the protected workflow and concurrency tests land.

## Implementation Basis

| Decision                                              | Basis                                               | Requirement and current consumer                                           | Evidence                                                                                                                                                                                                                                    |
| ----------------------------------------------------- | --------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Extend the existing domain-service update             | User requirement; durable rule                      | Update use case enforces type immutability after usage                     | `makeUpdate` in `src/domain/counterparty/services/counterparty.service.ts`; `.agents/rules/service-ownership.md` permits invariant reads                                                                                                    |
| Repository-backed usage lookup                        | Rule; local precedent                               | Domain service needs only whether usage exists                             | `makeCreateHeader` in `src/domain/ledger/services/asset-account/receivables-account.service.ts` reads a repository before enforcing an invariant; `journalLineRepo.findAllByAccountId` provides the paginated journal-line lookup precedent |
| Reuse entity mutations and audited repository writes  | Local precedent                                     | Allowed updates preserve versions, events, and audit                       | `counterpartyEntity.update`; `counterpartyRepo.update`; `makeUpdateCounterpartyUsecase`                                                                                                                                                     |
| Context-owned conflict through existing HTTP envelope | Rule; local precedent                               | Editor must explain why type is fixed and direct creation of a replacement | `counterpartyError.AlreadyActive`; `IHttpErrorDto`; `.agents/rules/error-creation.md`                                                                                                                                                       |
| Preserve optimistic counterparty concurrency          | Previously resolved user decision                   | Current PATCH clients submit expectedVersion                               | Completed update-and-activate plan; `counterpartyMutationPolicy.validate`                                                                                                                                                                   |
| Existing references only                              | User decision                                       | Domain service determines current type-change eligibility                  | Review comment 1; archived references count, removed references do not                                                                                                                                                                      |
| Manual transaction and parent Update lock             | Latest user instruction; existing capability        | Update use case protects the usage check until commit                      | `IRepoService.createTransaction`, `IRepoTransaction`, `ERepoLock.Update`; `accountingEntityRepo.findById` and `getDbQuery`                                                                                                                  |
| Reuse existing foreign-key coordination               | Existing schema guarantee; smallest coherent change | Concurrent transaction association waits for the parent lock               | `journal_lines_counterparty_id_fkey` in migration 0038; PostgreSQL FK key-share locking; required real database concurrency tests                                                                                                           |

## Scope

### Expected Changes

- `src/domain/counterparty/services/counterparty.service.ts` and
  `types/counterparty.service.types.ts`: inject the read dependency and make
  `update` asynchronous, accepting read options and returning the existing
  audited counterparty result in a Promise.
- `src/domain/journal-entry/repos/journal-line.repo.ts` and its existing infra
  implementation: add tenant-scoped `findAllByCounterpartyId` with pagination
  and optional locks on journal-line rows.
- `src/infra/persistence/repos/counterparty/counterparty.repo.impl.ts`: support
  the existing lock option on `findById`; no journal-line lookup belongs here.
- `src/domain/counterparty/errors/counterparty.error.ts`: add the specific
  type-change-after-usage conflict. Keep the decision inside the domain service.
- `src/app/counterparty/usecases/update-counterparty.usecase.ts`: await the
  service inside a caller-owned manual transaction; lock the scoped counterparty,
  pass the same transaction through preparation and writes, commit, publish,
  and dispose before settling. Preserve history and persistence ownership.
- `src/infra/ioc/services/counterparty.ts`: inject the existing repository into
  the domain service factory.
- `src/infra/ioc/usecases/counterparty.ts`: inject the existing `repoService`;
  reuse its shared mock and the established transaction contract in tests.
- `src/infra/persistence/repos/__specs__/repo-locks.spec.ts`: include counterparty
  `findById` in the existing locking-SQL contract coverage.
- Existing domain-service/repository mocks, service construction sites, domain
  specs, use-case specs, repository specs, HTTP specs, and PostgreSQL specs.
- `src/interface/http/controllers/counterparty.controller.ts`: document the
  usage conflict and expected client guidance in the operation description;
  regenerate TSOA artifacts if its documentation changes.

### Out of Scope

- A new update/activation service, endpoint, or public request flag supplied by
  the client to claim that a counterparty is unused.
- Restricting roles, names, or metadata based on usage beyond existing validation.
- Rewriting transactions or their audits when counterparty details change.
- Automatic creation of a replacement counterparty after a conflict.
- Permanent historical-usage tracking, migrations, and backfills.
- New transaction/lock infrastructure, new `findByIdForUpdate` methods, new
  write-option lock fields, isolation-level configuration, or automatic retries.
- Journal association-write changes: reuse the existing foreign key and prove
  the resulting coordination in integration tests. If that proof fails, revisit
  the design rather than silently expanding scope or claiming the race is fixed.
- Database resets or carrying forward the earlier original-migration-edit
  authorization into new schema work without checking its applicability.
- Unrelated cleanup of the staged implementation or its previously reported
  test-name issue.

## Proposed Approach

### 1. Enforce the rule through the domain service

Extend the existing factory with a required `journalLineRepo` dependency.
Keep `create` synchronous; only `update` becomes asynchronous. Its contract is:
prepare a valid audited mutation, or reject without writes or side effects.
Accept the existing `IReadRepoOptions` carrying correlation context and the
caller-owned transaction. The service performs its usage read in that context;
it does not create, commit, or dispose the transaction. Document the production
caller's requirement to hold the counterparty lock throughout preparation and
persistence. Do not add a missing-dependency fallback that skips validation.

Validate the source and requested field values using existing domain validation.
Within `makeUpdate`, compute a named `isTypeChange` condition: type is supplied
and differs from the current type. Only that condition requires the usage read.
An explicitly unchanged type may accompany valid name/metadata changes; it must
not be treated as a prohibited type change. Preserve the existing rejection of
an effective no-change request.

For an actual type change, await the usage query with the counterparty ID and
accounting entity ID from trusted current state. If usage exists, throw the
counterparty-owned conflict before preparing the final entity/events/audit.
Query failure must reject the update; it must never be interpreted as no usage.
Otherwise continue the existing metadata replacement and entity-update path.

Replace the former deferred TODO with a concise contract comment explaining
that the caller must hold the counterparty Update lock through the usage check
and persisted mutation. The guarantee is implemented by the use case, not by
an uncoordinated service read alone.

As explicitly requested, put the usage lookup and rejection in
`services/validations/counterparty.validation.ts` as `validateTypeChangeAllowed`,
with dedicated tests. Keep the actual-type-change condition in `makeUpdate`.
The entity remains responsible for immutable state, versions,
status/field invariants, and audit/event generation, without repository access.

### 2. Read only the persisted usage fact

Add `journalLineRepo.findAllByCounterpartyId(id, accountingEntityId, options)`
returning `IJournalLine[]` with `IReadRepoOptions`. Scope through the journal
header's accounting entity and include every journal status. Use one query
without search, sorting, pagination or counting. The domain validation rejects
an actual type change when the returned array has `length > 0`.

Honor `options.lock` on the result query, targeting only the journal-line table
using the same unqualified lock-target alias pattern as
`ledgerAccountRepo.findByCode`. The counterparty
workflow passes `{ correlationId, tx }` to the domain service and holds
`ERepoLock.Update` on the parent counterparty from its earlier `findById`.
An empty journal-line result cannot protect the first association; the parent
lock supplies that guarantee.

The repository reports a storage fact only. It does not inspect proposed type,
decide update eligibility, invoke the domain service, or persist anything during
this read. It queries current references only; removed references and historical
audit snapshots do not block a type change when no current references remain.

### 3. Hold the parent lock through the manual transaction

Extend `counterpartyRepo.findById` to build its existing scoped query and apply
`.for(options.lock)` when requested, using `accountingEntityRepo.findById` as the
precedent. Reads with no requested lock retain their existing behavior. Reuse
`getDbQuery` for the missing-transaction guard. Do not add a separate lock method.

Use one short manual transaction for the update workflow, including ordinary
detail edits, so there is a single preparation/persistence/cleanup path:

1. Validate the ID and DTO, obtain trusted context, and map changes before
   acquiring a connection.
2. `const transaction = await deps.repoService.createTransaction()`, immediately
   followed by `try/catch`. Await every operation sequentially.
3. Inside `try`, call tenant-scoped `findById` with
   `{ correlationId, tx: transaction.context, lock: ERepoLock.Update }`. Apply
   `counterpartyMutationPolicy.validate` to the returned locked state, including
   `expectedVersion`. Do not use a pre-lock snapshot for domain decisions.
4. In the preparation phase, await `counterpartyService.update` with
   `{ correlationId, tx: transaction.context }`. Its usage query is a separate
   SQL statement after the locked read completes. Build history from the audited
   result with the trusted actor and correlation ID.
5. In the persistence phase, invoke `counterpartyRepo.update` directly with the
   same transaction context, expected version, and prepared history. Its existing
   nested transaction joins the manual context via a savepoint; it must not
   acquire another pool connection or release the outer lock.
6. Await `transaction.commit()` exactly once after the
   entity/history writes. Keep the audited result local to `try`; after disposal,
   enrich/publish events and return the existing mapped DTO from `try`.
7. In `catch`, return `transaction.handleError(error)`. The handler disposes
   according to transaction state and always rejects. No outer result/error
   variables or `finally` are needed. Publication follows commit and connection
   disposal; publication failure cannot roll back committed work. Never reuse
   the released context.

Keep transaction ownership in the use case and domain decisions in the service.
The named reason for preparation inside the transaction is to prevent a new
transaction reference from committing between the usage check and type mutation.
Retain version predicates and version-conflict behavior even though the current
row is locked. Do not bypass `local/require-transaction-disposal` in production.

### 4. Use the existing foreign key to coordinate associations

PostgreSQL's foreign-key check obtains a key-share lock on the referenced row.
`FOR UPDATE` conflicts with that mode; `FOR NO KEY UPDATE` does not. This is why
the plan specifies `ERepoLock.Update`. The existing counterparty foreign key
therefore provides association-side coordination without new journal writes.
See the [PostgreSQL foreign-key implementation](https://doxygen.postgresql.org/ri__triggers_8c_source.html)
and [row-lock conflict table](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS).

At Read Committed, the separate usage query after lock acquisition observes
associations committed while the locked read was waiting. If the update gets
the lock first, an insert or change of reference to that counterparty waits
until the update finishes. The valid ordering is then type change followed by
association. If association commits first, the type change sees usage and
rejects. This is a design inference to prove with real database tests, not a
claim that the current counterparty workflow already enforces it. The separate
statement matters because Read Committed takes statement snapshots; see
[transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html).

Verify the test database uses Read Committed and the enabled, immediate
`journal_lines_counterparty_id_fkey` from the existing migration. Cover inserts,
null-to-ID changes, and changes from another counterparty. Do not combine the
locked read and usage lookup into one statement or weaken the lock mode.

### 5. Explain rejection

Add `TypeChangeAfterTransactionUse` with error key
`counterparty_error_type_change_after_transaction_use_conflict`. Use the existing
cause shape for actionable context, for example:

```json
{
  "field": "type",
  "reason": "transaction_usage",
  "nextAction": "create_counterparty"
}
```

Document the client copy associated with the key:
“This counterparty's type cannot be changed because it has been used in a
transaction. Create a new counterparty if a different type is required.”

Keep raw transaction data out of the response. The backend guarantees the
specific 409 key and recovery context. The frontend must render the explanation
and instruction; record that integration explicitly rather than claiming a
backend test proves visible UI messaging.

A rejected combined request saves none of its accompanying name, role, status,
or type changes. It creates no successful-update audit and publishes no event.
Allowed updates continue to generate exactly the existing update or activation
audit, with actor, correlation ID, before/after values, and incremented version.

## Test Plan

- **Domain service:** unused counterparties can change type in both directions;
  any qualifying usage blocks both directions; omitted/same type skips the
  usage read and allows other valid changes; usage reads are scoped correctly;
  query failure rejects; conflict contains its specific key and recovery context;
  combined type/name/meta/activation failure leaves input unchanged. Preserve
  creation, completeness, role replacement/removal, no-change, and activation tests.
- **Async integration:** update all callers to await `update`, adapt mocked
  resolved/rejected results, and inject repositories into all service factories.
  Domain tests use locally composed typed mocks; app/infra/HTTP tests use the
  existing centralized mocks. Do not import app mocks into the domain.
- **Repository:** unused/null references return empty arrays; actual references
  return all matching journal lines in one query; foreign accounting
  entities do not match; Draft, Posted, Archived, and retained reversed entries
  all count. Removing the last reference or deleting the last referenced
  transaction returns an empty array; another remaining reference, including an
  archived one, is still returned. Old audit snapshots alone must not count as usage.
  Verify `findById` emits the requested lock with a supplied transaction, emits
  no lock when omitted, rejects lock-without-transaction, and preserves both ID
  and tenant predicates. Verify the usage read and writes use the same context.
- **Use case:** stale/missing/foreign records fail before service preparation;
  the async domain rejection prevents repository writes/history/event
  publication; successful updates preserve expectedVersion and atomic history.
  Cover transaction acquisition failure, locked-read failure, service failure,
  write/history failure, commit failure, and cleanup failure. Verify commit
  ordering, unconditional awaited disposal, operation-error preservation, and
  no publication until successful commit, and disposal before settling. Cover
  publication failure and combined operation/cleanup failure. Do not claim an uncertain
  network failure during commit necessarily rolled back a server-side commit.
- **HTTP:** the real service/use-case path returns 409 for a used type change,
  including field/reason/nextAction; same or omitted type with other changes
  succeeds; unused type change succeeds; existing validation and access controls
  hold. A conflict must not be reduced to a generic invalid-type or 500 response.
- **PostgreSQL:** create real transaction references, including archived ones;
  assert conflict for a used type change and success for allowed edits. Snapshot
  all associated stored entry/line rows, versions, timestamps, and journal audit
  rows before allowed counterparty updates and compare afterwards. Joined
  counterparty display details can change; stored transactions cannot.
  Delete a never-posted transaction or remove its last reference through the
  existing journal workflow, then verify a type change succeeds. Also verify
  deleting one of multiple references does not unblock type changes.
- **Audit and rollback:** successful updates add one correctly attributed audit;
  blocked changes add none and leave type/version/metadata intact; a history
  insertion failure rolls back the counterparty write and publishes no event.
- **Concurrency:** use independent PostgreSQL connections, barriers, and
  observable blocking state instead of timing sleeps. Prove both schedules:
  association holds its FK lock first, then commits and causes the waiting type
  change to reject; type change holds its Update lock first, and association
  cannot finish until type change commits. Exercise actual journal-line insert,
  null-to-ID update, and reassignment from another counterparty, including
  existing draft rectification paths. Assert a rejected update adds no audit.
  Prove association rollback lets a waiting unused type change succeed; prove
  counterparty rollback releases the waiter without committing details/history.
  Keep existing two-counterparty-update races: the loser gets a stale-version
  conflict and no audit. Verify unrelated counterparties can progress. Do not
  retain the deferred TODO after this coverage passes.

Keep 100% coverage for touched behavior. Reuse the current test locations,
especially `test/db/counterparty/update-counterparty.db.spec.ts` and
`test/db/journal-entry/draft-counterparties.db.spec.ts`.

## Verification

Implementation commands; these have not been run as part of this planning task:

```bash
npm run test:types
npx jest --runInBand src/domain/counterparty src/app/counterparty src/infra/persistence/repos/counterparty
npx jest --runInBand src/infra/persistence/repos/__specs__/repo-locks.spec.ts src/infra/persistence/repos/journal-entry/__specs__/journal-line.repo.impl.spec.ts src/infra/services/__specs__/repo.service.spec.ts
npm run build:routes
npx jest --runInBand test/http/counterparty
npm test -- --config jest.db.config.js --runInBand test/db/counterparty test/db/journal-entry/draft-counterparties.db.spec.ts
npm run test:names
npm run lint
npx tsc -p tsconfig.build.json --noEmit
npm test -- --runInBand
```

Run focused coverage for all changed behavior. PostgreSQL tests require an
already migrated disposable database ending in `_test` with NGN/NG reference
data and `POSTGRES_URL` configured. Report unavailable database checks honestly.
Do not reset a database. Review generated files for unrelated churn and preserve
the index. Recheck the prior reported test-name issue rather than assuming its
current status.

## Resolved Decisions

1. **Existing references only:** review comment 1 confirms that all currently
   referenced transactions count, including archived ones. Removing the last
   reference or deleting its transaction permits a type change again. Do not
   add permanent-use tracking or query historical audits for this invariant.
2. **Use the newly implemented transaction/lock infrastructure:** the latest
   user request supersedes review comment 2's deferral. Introduce the protected
   counterparty update workflow using `createTransaction`, `context`, `commit`,
   `dispose`, and `IReadRepoOptions.lock`. Retain optimistic versions; remove
   the requirement to add a concurrency TODO. Existing FK coordination must be
   verified by the specified PostgreSQL tests before claiming completion.

No material decisions remain open. The plan is ready to implement; merely
having the transaction APIs available has not fixed the current update flow.

## Risks

- An ignored or weaker lock, a usage read on a different connection, or an early
  commit reopens the race. Lock-SQL, transaction propagation, and real concurrent
  FK-write tests are required; an existence-query unit test is insufficient.
- Lock waits extend connection lifetime. Keep the transaction local and short,
  dispose on every exit, and do not add automatic retries. Deadlock or connection
  failure must follow the existing transaction failure contract without partial
  counterparty/history writes or premature events.
- The design relies on the existing enabled FK and Read Committed behavior.
  If either guarantee changes or integration tests disprove the coordination,
  revise the design rather than removing the safety requirement.
- Historical audit records must not accidentally keep type changes blocked after
  the last current reference is removed; cover deletion/removal explicitly.
- Adding a repository dependency to the existing service factory affects
  creation fixtures even though creation behavior stays synchronous. Update
  all callers rather than making the dependency optional.
- Backend error keys do not automatically produce visible frontend guidance;
  the client integration must map the documented key and recovery action.

## Completion Criteria

- Actual type changes are rejected when the domain usage check finds an existing
  reference, including an archived transaction. Removing all current references
  permits a type change again, subject to existing field/status/version checks.
- The use case holds the scoped counterparty Update lock across the domain
  usage query, versioned write, and history until manual commit. Every acquired
  transaction is disposed before settling; events occur only after commit.
- Real PostgreSQL tests prove new references cannot commit in the check/write
  gap, including reference-changing updates; no deferred concurrency TODO remains.
- Used counterparties still accept valid name/metadata edits with type omitted
  or unchanged, including the agreed full role replacement behavior.
- Domain service owns the usage decision; repositories report facts; the use
  case initiates every write and the repository retains atomic update/history
  persistence.
- A blocked change returns the documented conflict and creation guidance,
  persists no partial changes/history, and publishes no event.
- Allowed changes preserve journal state and produce the existing atomic audit.
- Activation, optimistic versions, tenant isolation, and previously implemented
  update behavior remain covered and pass regression checks.
- Required verification passes or infrastructure limitations are reported;
  frontend messaging verification is identified separately where external.
- Preserve staged changes and report any approved deviation from the prior
  design with its verification evidence.
