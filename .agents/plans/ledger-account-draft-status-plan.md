# Ledger Account Draft Status Plan

## Goal

Introduce `draft` as a supported ledger-account status in the domain model,
database enum, and generated schema/response contracts. This is the first,
foundational change, rather than implementation of the entire draft-account
ticket.

Implementation-ready. Preserve unrelated staged and working-tree changes.

## Context

- The user explicitly requested introducing the status first and authorized
  editing existing migrations because the project is local and not live.
- Draft accounts will require complete proposed data; this change does not make
  any existing required field optional.
- `ELedgerAccountStatus` currently contains `Active` and `Archived` in
  [`ledger.types.ts`](../../src/domain/ledger/types/ledger.types.ts).
- Migration `0029_ledger-accounts.ts` creates the PostgreSQL enum. Drizzle files
  are generated from the database, not maintained by hand, per the
  [migration skill](../skills/migration/SKILL.md).

## Domain Language And Existing Guarantees

- **Authoritative state:** `ILedgerAccount.status` stores the account status;
  PostgreSQL constrains stored values with `core.ledger_account_status`.
- **Domain terms:** Add `Draft` with serialized value `draft`, retaining `Active`
  and `Archived` with their existing values.
- **Existing guarantees:** All required account fields, account codes, paths,
  versions, and persistence transactions remain as they are. Existing account
  creation services continue to produce Active accounts in this step.

## Confirmed Findings

1. `ULedgerAccountStatus` is derived from `ELedgerAccountStatus`.
   `ledgerAccountValidation.validateStatus` uses `Object.values` of that same
   definition, so adding Draft makes the existing validator accept it without a
   new validation branch.
2. `ledgerAccountEntity.make` validates and preserves the supplied status,
   including it in the existing created event and audit data.
3. `ledgerAccountMapper.toRepo` and `toDomain` pass status through. Their model
   type derives from the generated Drizzle schema, so the database and domain
   enum changes must be kept synchronized.
4. `ILedgerAccountDto.status` uses `ULedgerAccountStatus`, and its mapper passes
   status through. The response type requires no separate handwritten union.
5. Account creation services currently supply `ELedgerAccountStatus.Active`;
   creation request DTOs do not expose a draft status option. This plan does not
   change those workflows.

## Implementation Basis

| Decision or change                       | Basis                                       | Current requirement and consumer                                                       | Evidence or rationale                                                                        |
| ---------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Extend the existing status definition    | Explicit user requirement; existing pattern | Represent Draft in ledger entities, validation, persistence mapping, and response DTOs | `ELedgerAccountStatus`, `ULedgerAccountStatus`, and `ledgerAccountValidation.validateStatus` |
| Edit the original enum migration         | Explicit user authorization                 | Ensure a fresh local database supports the new ledger status                           | `db/migrations/0029_ledger-accounts.ts`, `up`; user permits direct migration edits           |
| Regenerate schema and response artifacts | Repository rule; existing tooling           | Keep Drizzle persistence types and API response contracts aligned                      | Migration skill; `drizzle.config.ts`; `tsoa.json`; package scripts                           |

No new service, repository operation, use case, transaction, or IoC wiring is
needed.

## Scope

### Expected Changes

- `src/domain/ledger/types/ledger.types.ts` — add `Draft: 'draft'` to
  `ELedgerAccountStatus`.
- `db/migrations/0029_ledger-accounts.ts` — include `draft` in the existing
  `pgm.createType(ledgerAccountStatus, ...)` call. Retain the existing enum
  identifier and down migration.
- `src/infra/config/drizzle/` — regenerate schema artifacts using
  `npm run drizzle:pull` after applying the edited migration to a fresh disposable
  local database. Do not edit these files manually.
- `src/domain/ledger/entities/__tests__/ledger-account.entity.test.ts` — extend
  existing status validation coverage and verify a fully specified Draft
  subaccount retains its status in the entity, created event, and audit.
- `src/infra/persistence/repos/ledger/mappers/__tests__/ledger-account.mapper.test.ts`
  — verify Draft survives persistence mapping in both directions.
- `src/app/ledger/dtos/ledger-account/__tests__/ledger-account.dto.mapper.test.ts`
  — verify the response mapper exposes `status: 'draft'`.
- `generated/` — regenerate TSOA contracts with `npm run build:routes` so ledger
  response schemas include Draft.

### Conditional Changes

- `db/docs/erd.dbml` and other outputs of `npm run db:docs` — regenerate the
  existing database documentation from the same updated disposable database;
  retain the outputs that actually change.

### Out of Scope

- Exposing draft creation through HTTP/MCP requests or modifying account
  creation services and authorization permissions.
- Draft eligibility, parent/control-account rules, and suspense restrictions.
- Journal posting restrictions, opening-balance behavior, balance propagation,
  and deferred supporting-account creation.
- Activation, status transitions, account selection, and UI changes.
- Relaxing required fields, adding a new incremental migration, or resetting
  the user's existing development database.

## Proposed Approach

1. Add `Draft: 'draft'` to the existing domain definition and `draft` to the
   original migration's enum values. Append the new value after the existing
   values in both definitions to preserve their relative order. Leave generic
   validation, mapping, creation workflows, and migration configuration alone.
2. Apply the migration chain to a fresh disposable local PostgreSQL database
   selected explicitly through `POSTGRES_URL`. An already-applied migration
   will not be replayed by `db:migrate up`; use the fresh database to verify the
   edited baseline without deleting existing development data.
3. Run `npm run drizzle:pull`, `npm run db:docs`, and `npm run build:routes`.
   Inspect generated diffs and keep this work scoped to status-related changes;
   investigate unrelated schema drift instead of incorporating it into the task.
4. Extend the existing entity and mapper tests with Draft examples. Use a valid,
   complete subaccount fixture with a parent; do not make root or suspense Draft
   behavior a new expectation in this foundational change.
5. Run the focused tests and static checks below. Inspect the final diff against
   the expected scope.

The existing domain validator owns status membership. PostgreSQL owns persisted
enum membership. Existing mappers preserve the value. No application persistence
call or transaction ownership changes are proposed.

## Test Plan

- **Domain:** Existing status validation accepts Draft, Active, and Archived and
  continues rejecting invalid values. A complete Draft subaccount can be built
  with `ledgerAccountEntity.make`, with the status preserved in its existing
  event and audit data.
- **Mapping:** Typed Draft data round-trips through the persistence mapper and
  appears unchanged in the ledger response DTO. Reuse nearby tests and fixtures;
  add no mocks or unsafe casts for the new status.
- **Database:** Apply the edited baseline to a disposable database and inspect
  `enum_range(NULL::core.ledger_account_status)` for all three values.
- **Regression:** Existing Active and Archived tests still pass; existing
  creation services still return Active. No new HTTP/MCP integration tests are
  necessary because their request behavior does not change.

Follow the existing [testing rules](../rules/testing/general.md), including
coverage requirements for touched behavior.

## Verification

Run database-dependent commands only with `POSTGRES_URL` explicitly targeting
the disposable local database. They require an available PostgreSQL instance.
No migration or database reset is run while preparing this plan.

```bash
npm run db:migrate up
npm run drizzle:pull
npm run db:docs
npm run build:routes
npm test -- --runInBand --runTestsByPath \
  src/domain/ledger/entities/__tests__/ledger-account.entity.test.ts \
  src/domain/ledger/entities/validations/__tests__/ledger-account.validation.test.ts \
  src/infra/persistence/repos/ledger/mappers/__tests__/ledger-account.mapper.test.ts \
  src/app/ledger/dtos/ledger-account/__tests__/ledger-account.dto.mapper.test.ts
npm run lint
npm run test:names
git diff --check
```

`npm test` runs the source/test type check through its existing pretest script.
Verify the generated ledger response status enum contains `draft`. Do not run a
full production build or source-map upload solely for this status addition.
If PostgreSQL is unavailable during implementation, report database/schema
verification as incomplete rather than manually editing generated Drizzle files.

## Completion Criteria

- Domain ledger status types and validation recognize `draft`.
- The edited baseline migration creates a PostgreSQL enum containing `active`,
  `archived`, and `draft`.
- Generated Drizzle types and TSOA response contracts recognize Draft.
- Entity, persistence mapper, and response mapper preserve Draft with complete
  account data; focused tests and required static checks pass.
- Existing public account creation behavior and required fields remain intact.
- No behavior from the rest of the draft-account ticket is implemented.
- Unrelated staged and working-tree changes remain intact.

## Implementation Status

Preflight complete. The working tree initially contained only this untracked
plan. Current status definitions, validation, entity construction, persistence
mapping, and response DTOs match the plan's findings. Local PostgreSQL is
reachable and the configured role can create a disposable database. No new
architecture or change to transaction ownership is required.

| Step | Outcome and owner                                                    | Basis and intended files/tests                               | Status                                                                       |
| ---- | -------------------------------------------------------------------- | ------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| 1    | Domain and database recognize Draft                                  | Explicit requirement; `ledger.types.ts` and migration `0029` | Complete; domain validation and database enum verified                       |
| 2    | Fresh baseline migration and database enum verified                  | Original migration; disposable local PostgreSQL database     | Passed; enum range is `{active,archived,draft}`; disposable database removed |
| 3    | Persistence types, database docs, and response contracts regenerated | Existing Drizzle, database docs, and TSOA generators         | Generators passed; retained only status-related output hunks                 |
| 4    | Entity and mapper status preservation tested                         | Existing entity, persistence mapper, and DTO mapper tests    | Complete; all four suites passed                                             |
| 5    | Focused tests, static checks, and final scope reconciliation         | Verification commands above                                  | Complete; 75 tests passed, type check/lint/test names/diff checks passed     |

### Verification And Reconciliation

- The edited migration chain ran successfully against a fresh disposable local
  database. PostgreSQL returned `{active,archived,draft}` from the enum-range
  query. The disposable database was removed; the existing development database
  was not migrated or reset.
- Drizzle, database documentation, and TSOA generators succeeded. Retained
  generated changes are the ledger status enum in `schema.ts`, `erd.dbml`,
  `generated/routes.ts`, and `generated/swagger.json`. Generation also exposed
  unrelated relationship ordering, index/operator-class differences, and stale
  audit documentation; those task-generated hunks were discarded. No generated
  schema definition was authored manually.
- Four focused test suites passed: 75 tests, with 100% statements, branches,
  functions, and lines for the ledger entity, ledger validator, persistence
  mapper, and DTO mapper. The existing invalid-status tests still pass.
- Source/test type checking, repository lint/import policy, test naming, and
  whitespace checks passed. Generated `ULedgerAccountStatus` advertises
  `active`, `archived`, and `draft`.
- Final changes are confined to the planned domain definition, original
  migration, generated status artifacts, three existing test files, and this
  implementation ledger. Required fields, account creation services, public
  request DTOs, authorization, and journal behavior are untouched. No unrelated
  baseline changes were present, and the pre-existing saved plan was preserved.
- Implemented without deviation.
