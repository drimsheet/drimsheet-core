# Update And Activate Counterparty Plan

## Goal

Support counterparty updates and Draft activation with optimistic versioning,
full role metadata replacement, and atomic entity/history persistence. Leave
journal entries unchanged. The user explicitly replaces the original locking
design and authorizes editing original migrations after resetting the database.

## Context And Existing Guarantees

- The previous implementation is staged; preserve the index and unrelated edits.
- Entity versions and client expectedVersion replace findByIdForUpdate and the
  outer use-case transaction. Use ordinary tenant-scoped reads.
- Domain services prepare updates; entities own invariant-preserving mutations.
- The repository transaction atomically saves the conditional update and history.
- Omitted meta preserves roles; supplied meta fully replaces them; {} clears roles.
- Only Draft to Active is allowed; roles remain optional. Repeated activation
  with a current version fails; stale requests receive a version conflict.
- Events are published after persistence using the existing best-effort bus.
- The configured local development database has no core tables and no applied
  migrations. Apply revised migrations and regenerate Drizzle, without manually
  editing generated database definitions.

## Implementation Basis

| Decision                                           | Basis                                       | Evidence and consumer                                                                               |
| -------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Optimistic versions and original migration edits   | Explicit user instruction                   | This conversation; counterparty update endpoint                                                     |
| Versioned repository options and conditional write | Existing precedent                          | IVersionedRepoWriteOptions, validateVersionInRepo, userRepo.update and ledgerAccountRepoImpl.update |
| Pre-read expected-version check                    | Existing precedent                          | journalEntryMutationPolicy.validate; equivalent app policy for counterparty update                  |
| Domain preparation before persistence              | User instruction and service-ownership rule | counterpartyService.update and counterpartyEntity.update                                            |
| Atomic entity/history repository transaction       | Existing precedent                          | counterpartyRepo.create and versioned user/ledger repository updates                                |
| Generated schema                                   | Migration skill                             | Revised original migrations followed by db:migrate up and drizzle:pull                              |

## Scope

- Counterparty entity, audit, DTO and persistence versions; affected fixtures.
- Required expectedVersion in the update DTO and an application mutation policy.
- Ordinary read/preparation/write use case, without transaction service or lock.
- Versioned repository write contract and ID/tenant/version predicate.
- Original migrations 0033_counterparties and 0034_counterparty-history;
  regenerated Drizzle and TSOA artifacts.
- Domain, app, adapter, HTTP, concurrency, rollback and journal regression tests.
- Exclude archiving, automatic posting, generic concurrency infrastructure,
  automatic retries, unrelated staged changes and existing test naming issues.

## Proposed Approach

1. **Domain:** make initializes version 1. Every entity mutation, including
   addRole and update, validates the source version and increments it once.
   Creation that composes role mutations persists the final entity/audit version.
   Reject no-change updates before incrementing. Audit entityVersion uses the
   resulting version. Preserve completeness and role replacement behavior.
2. **Application:** full counterparty DTOs expose version. Updates require a
   positive integer expectedVersion plus at least one editable field. The mapper
   excludes expectedVersion from domain changes. An app mutation policy handles
   missing/foreign records and stale versions before domain preparation.
   Read, prepare entity/events/history, invoke the repository, then publish.
   No use-case transaction service remains.
3. **Repository:** remove findByIdForUpdate. Use IVersionedRepoWriteOptions and
   validateVersionInRepo to check entity/history versions equal expectedVersion
   plus one. Within the repository transaction, update matching ID, tenant and
   version. Zero affected rows raises repoError.VersionNotFound without history.
   Save history in the same transaction; a failure rolls both writes back.
4. **Schema:** add required integer version defaulting to 1 in the original
   counterparty migration, and required entity_version in the original history
   migration. Map both fields and regenerate schema from the migrated database.
5. **Delivery and tests:** regenerate TSOA; preserve authentication and tenant
   access. Replace lock-oriented tests with stale client and concurrent prepared
   write tests. Only one competing write and audit may succeed.

## Test Plan

- Entity make/mutations and audits agree on versions; invalid versions reject;
  no-change behavior, activation and role removal stay intact.
- DTO validates expectedVersion, rejects version-only requests, and exposes the
  resulting version. Persistence and history mappers round-trip versions.
- Use-case ordinary reads carry no transaction; stale requests fail before
  domain preparation; repo receives expectedVersion; failed writes publish nothing.
- Repository SQL matches tenant and expectedVersion; mismatched entity/history
  versions reject; zero-row writes produce a conflict and no audit.
- HTTP covers stale 409, current-version repeated activation 409 and malformed
  expectedVersion 422 alongside existing authentication and update behavior.
- PostgreSQL tests synchronize preparation, then race two writes from one version;
  assert one success, one conflict, no loser audit, and rollback on history failure.
- Activation leaves stored journals unchanged; separate valid posting still works.

## Verification

Run migrations and introspection on the reset local development database. Run
PostgreSQL regression tests only on a migrated disposable database ending in
\_test; never reset an existing database for verification.

```bash
npm run db:migrate up
npm run drizzle:pull
npm run build:routes
npm run test:types
npx jest --runInBand src/domain/counterparty src/app/counterparty src/infra/persistence/repos/counterparty
npx jest --runInBand test/http/counterparty
npm test -- --config jest.db.config.js --runInBand test/db/counterparty test/db/journal-entry/draft-counterparties.db.spec.ts
npm run lint
npx tsc -p tsconfig.build.json --noEmit
npm test -- --runInBand
```

Review generated diffs for unrelated introspection churn. Require 100% coverage
of touched behavior; emitted decorator metadata branches are not product behavior.

## Implementation Status

Implementation complete. The previous implementation and plan are staged,
including minor user edits. The index is preserved. User-approved revision: replace row
locking and the outer transaction with optimistic versions, and edit original
migrations directly. No additional architectural deviation is needed.

| Slice                             | Owner and precedent                          | Files/tests                                                   | Status                                                |
| --------------------------------- | -------------------------------------------- | ------------------------------------------------------------- | ----------------------------------------------------- |
| Entity and audit versions         | Domain; existing versioned entity mutations  | Counterparty entity/validation/types/audit and tests          | Complete                                              |
| expectedVersion and orchestration | App; journal-entry mutation policy           | DTO, policy, use case, IoC and tests                          | Complete                                              |
| Conditional write and schema      | Infra; versioned repositories and migrations | Repo/mappers, original migrations, generated schema and tests | Complete                                              |
| Verification                      | All affected layers                          | HTTP, PostgreSQL and full regression suites                   | Complete; pre-existing test-name issue recorded below |

Verification results for this revision:

- Original migrations applied successfully to the reset development database.
  Drizzle introspection generated both new columns. Retained those generated
  column definitions programmatically while preserving unrelated existing
  generated definitions; discarded introspection ordering/index metadata churn.
- TSOA routes/specification regenerated and formatted.
- Test type checking, build type checking, lint and import policy pass.
- Focused tests: 21 suites / 376 tests pass. All touched domain, DTO, app policy,
  use-case, repository and mapper behavior reaches 100% statement, branch,
  function and line coverage with an enforced threshold. The untouched
  declarative counterparty policy is excluded from this focused coverage set.
- Full regression suite, including HTTP: 454 suites / 4,618 tests pass.
- PostgreSQL: 2 suites / 12 tests pass, including independent concurrent writes,
  stale-client rejection, audit rollback, journal preservation and later posting.
  Used a newly created isolated counterparty_version_20261001_test database with
  NGN/NG reference seeds; removed this task-created database after verification.
- The database run exposed cross-context JSON prototype rejection in existing
  metadata validation. Replaced that identity check with lodash's plain-object
  check; regression tests cover cross-context JSON and rejected class instances.
  This bounded correction is required to validate persisted metadata on activation.
- Test-name check reports the pre-existing unrelated mismatch at
  src/infra/persistence/helpers/**tests**/get-db-query.test.ts (expected
  **specs**/get-db-query.spec.ts); left unchanged.

All approved behavior is implemented. The concurrency and original-migration
changes follow the explicit user revision; no additional architectural deviation
was introduced. The index and unrelated changes remain untouched.

## Completion Criteria

- No counterparty row-lock lookup or outer update use-case transaction remains.
- Updates require expectedVersion and DTOs expose the current version.
- Entity, audit and database versions agree and mutations increment once.
- Stale/concurrent writes cannot overwrite changes or add a losing audit.
- Repository entity/history persistence remains atomic.
- Activation, metadata replacement, access control and journal isolation hold.
- Original migrations and generated schema reflect versioned counterparties.
- Tests and checks are recorded, with unavailable verification stated explicitly.
