# Draft Ledger Account Creation API Plan

## Implementation Status

Preflight complete: current contracts, creation factories, transaction owners,
FX guard, opening-journal preparation, response helper, and IoC match this plan.
The existing staged status-foundation diff is preserved. No deviation required.

| Slice                          | Owner and basis                                                  | Files and tests                                                                          | Status                                                            |
| ------------------------------ | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Creation contracts             | Domain/app; existing status and DTO composition patterns         | Ledger types, five DTO families, eight use cases; DTO/use-case tests                     | Implemented and verified                                          |
| Prepared domain state          | Domain; existing audited factories and journal status derivation | Subaccount factories/contracts, journal preparation; domain tests                        | Implemented and verified                                          |
| Draft accounting effects       | App; existing transaction and Posted guards                      | Cash use cases, response helper; use-case/helper/DB tests                                | Implemented; unit tests verified, DB check unavailable            |
| HTTP contract and verification | Interface; existing TSOA/Supertest boundaries                    | Controller descriptions, generated contracts, HTTP tests; focused checks, coverage, lint | Implemented; generated contracts verified, HTTP check unavailable |

Implemented without deviation. The final diff matches all planned production and
test boundaries. Existing staged status-foundation changes remain unchanged.

Verification evidence:

- TSOA route/OpenAPI regeneration and source/test type checks passed.
- All 76 domain/application suites passed (1,250 tests), with 100% statement,
  branch, function, and line coverage across every changed executable domain/app
  implementation. This includes Draft/Active/omitted status, entity/event/audit
  consistency, a Draft control parent, functional/foreign Draft openings,
  transaction writes, zero response balances, and suppressed FX/propagation.
- Lint, import-path policy, test filename checks, and `git diff --check` passed.
- HTTP specs were added for all eight endpoints and type-check successfully.
  Execution is outstanding: Supertest cannot bind its local listener in this
  sandbox (`listen EPERM`).
- The foreign Draft opening database test was added to the existing suite.
  Execution is outstanding: `POSTGRES_URL` is unset. The disposable-database
  guard stopped the test before any database writes.
- Use `--config jest.db.config.js` for the database command below; the default
  Jest configuration intentionally excludes `test/db`. This corrects the
  verification invocation without changing the implementation scope.

## Goal

Expose Draft creation through the existing account-specific creation APIs and
use cases. A complete request can create a Draft subaccount. Where the current
API accepts an opening balance, save its opening journal as Draft, skip FX lot
acquisition, and schedule no balance propagation.

Implementation-ready. Preserve the staged status-foundation changes and all
other unrelated staged and working-tree changes. This is a new plan; retain
`ledger-account-draft-status-plan.md` as the completed foundation's plan.

## Context

- The user requested an API for complete proposed account data, with no FX lot
  allocation and no propagation of Draft opening journals.
- This plan follows the recommendation to extend existing use cases with
  `status?: 'active' | 'draft'`, preserving Active behavior when omitted.
- Draft already exists in the domain, migration, generated database schema,
  and response contracts. No further status migration is needed.
- The existing APIs cover bank, petty cash, trade/statutory receivables,
  trade/statutory payables, revenue, and expense subaccounts. Only bank and petty
  cash creation currently accept an opening balance.

## Domain Language And Existing Guarantees

- **Authoritative state:** The newly prepared ledger account's `status` determines
  whether its opening-balance journal is Draft. The journal's `postedAt` and
  resulting status determine whether accounting effects are scheduled.
- **Domain terms:** A subaccount has a parent/control account and may itself be
  a control account. Control accounts remain ineligible for journal lines,
  including opening balances, under existing rules.
- **Existing guarantees:** Account creation use cases own their transactions.
  Domain services lock allocation roots and parents, allocate codes, and prepare
  entities without writes. Persistence services join the caller's transaction.
  Account, balance record, applicable bank details, opening journal, and audit
  histories retain the existing atomic write boundary.
- **Draft balances:** The stored account balance remains zero until posting.
  A captured opening amount belongs to the Draft journal, not to posted balances.

## Confirmed Findings

1. Creation DTOs do not accept status. Several use Zod `.strict()`, so adding
   status requires both DTO and validation changes. `zodValidationRunner`
   validates but does not return transformed/defaulted parsed data.
2. Account-specific subaccount factories hardcode Active. Passing the requested
   status before `ledgerAccountEntity.make` is necessary to keep the entity,
   creation event, and audit consistent. The existing header/suspense factories
   have separate contracts and can remain unchanged.
3. `prepareOpeningBalance` in
   [`journal-entry.service.ts`](../../src/domain/journal-entry/services/journal-entry.service.ts)
   always sets `postedAt: effectiveDate`. The journal entity derives Posted or
   Draft from `postedAt`.
4. Both cash creation use cases invoke `fxLotAppService.acquire` after preparing
   an opening journal. The FX service already returns `null` for Draft journals,
   but the use cases still need to skip the invocation to satisfy the user's
   requirement that Draft creation not trigger FX allocation.
5. The cash creation use cases already condition outbox creation and queue
   submission on a Posted journal. These guards can be retained.
6. `ledgerAccountToDtoMapperHelper` currently treats any supplied opening
   journal's account line as the response balance. It must exclude Draft journals
   to report the same zero balances that persistence stores.
7. The existing parent validators enforce accounting entity, type/subtype,
   behavior, and currency compatibility without restricting parent status. They
   already permit an otherwise valid Draft control account as a parent.
8. Existing HTTP controllers delegate to account-specific use cases; existing
   IoC wiring provides all dependencies needed for this extension. The ledger
   authorization resource metadata is not consumed by these creation paths.

## Implementation Basis

| Decision or change                                                     | Basis                                                                        | Current requirement and production consumer                                                           | Evidence or rationale                                                                                   |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Extend current APIs/use cases                                          | User-requested plan for the recommended extension; scope-and-simplicity rule | AI callers creating complete Draft accounts through current HTTP endpoints                            | `AccountsController`, `LedgerController`, and the eight existing creation use cases                     |
| Add a restricted creation-status type and reusable DTO field validator | Existing domain/type and DTO composition patterns                            | Creation request DTOs and the subaccount service payloads must allow Active/Draft, excluding Archived | `ledger.types.ts`; existing field validators in `ledger-account.dto.validation.ts`                      |
| Set status in existing domain factories                                | Domain ownership rule; existing entity creation pattern                      | Subaccount creation must produce correct entity/event/audit status                                    | `cashAccountService.createBankSubAccount`, `createPettyCashSubAccount`, and equivalent family factories |
| Derive opening-journal posting state from account status               | Explicit user requirement; existing journal status derivation                | Initial opening journals prepared for bank and petty-cash creation                                    | `prepareOpeningBalance`; `journalEntryEntity.make`                                                      |
| Skip FX acquisition and retain Posted propagation guards               | Explicit user requirement; existing orchestration pattern                    | Bank and petty-cash creation use cases                                                                | `fxLotAppService.acquire`, `postedJournal`, `outboxService.createBalancePropagation`, queue `add`       |
| Return zero balances for Draft openings                                | Existing persisted zero-balance guarantee and no-propagation requirement     | Creation response DTOs                                                                                | `ledgerAccountPersistenceService.create`; `ledgerAccountToDtoMapperHelper`                              |

No new use case, service, endpoint, transaction mechanism, or IoC dependency is
proposed.

## Scope

### Expected Changes

- `src/domain/ledger/types/ledger.types.ts` — add a narrow, named
  `ULedgerAccountCreationStatus` type containing `active` and `draft`, for the
  current creation DTOs and service payloads.
- `src/app/ledger/dtos/{asset-account,receivable-account,payable-account,revenue-account,expense-account}/`
  — add optional status to the eight creation request shapes and validations.
- `src/app/ledger/dtos/ledger-account/ledger-account.dto.validation.ts` — expose
  a reusable Active/Draft creation-status validator using `InvalidStatus`.
- `src/domain/ledger/types/` — extend only subaccount payload contracts consumed
  by these APIs: cash, receivables, payables, the six supported revenue service
  contracts, and the eight supported expense service contracts.
- `src/domain/ledger/services/asset-account/{cash-account,receivables-account}.service.ts`,
  `liability-account/payables.service.ts`, and the supported
  `revenue-account/` and `expense-account/` factories — set the requested status
  during subaccount creation, defaulting to Active when omitted.
- `src/app/ledger/usecases/create-{bank,petty-cash,trade-receivable,statutory-receivable,trade-payable,statutory-payable,revenue,expense}-account.usecase.ts`
  — forward status and adjust the two cash workflows' FX invocation.
- `src/domain/journal-entry/services/journal-entry.service.ts` — prepare Draft
  opening journals for Draft accounts through the existing shared preparation.
- `src/app/ledger/usecases/helpers/ledger-account-to-dto-mapper.helper.ts` — use
  opening lines as response balances only for Posted journals.
- Nearby DTO, domain-service, use-case, response-helper, and HTTP tests — cover
  the new behavior in their current suites.
- `src/interface/http/controllers/{accounts,ledger}.controller.ts` — update
  creation descriptions to document the optional status; retain delivery-only
  behavior and existing routes.
- `generated/routes.ts` and `generated/swagger.json` — regenerate request
  contracts using `npm run build:routes`.

### Out of Scope

- Activation, other status transitions, or deferred-account provisioning.
- New MCP write tools, a generic draft-account endpoint, and account selectors.
- Journal posting restrictions outside this account-creation workflow.
- Adding opening-balance support to account families that do not currently have it.
- New status options for headers, suspense accounts, equity bootstrap, or
  short-term loans without a current creation API.
- Altering required fields, parent eligibility rules, accounting-period
  validation semantics, bank-detail persistence, or concurrency guarantees.
- Further migrations or unrelated refactoring.

## Proposed Approach

### 1. Extend the existing creation contracts

- Add the narrow creation-status type, optional status fields, and composed
  Active/Draft validation. Archived and invalid values must be rejected.
- Retain every existing account-data requirement, including bank details and
  current opening-balance currency/exchange-rate validation.
- Forward `payload.status` from each use case to its domain subaccount factory.
  Normalize omitted status with `payload.status ?? ELedgerAccountStatus.Active`
  in the factory before entity creation. Do not rely on a Zod `.default()` being
  applied to the original request by `zodValidationRunner`.
- Keep the header and suspense request contracts unchanged. All modified
  factories remain subaccount operations and retain existing parent resolution.

### 2. Prepare the correct domain state

- The existing domain factories own account status at creation. Do not change
  status by spreading or rewriting an already audited entity in a use case.
- Preserve current parent and code-allocation validation, including creation
  beneath a valid Draft control account and creation of a subaccount that is
  itself a control account.
- In `prepareOpeningBalance`, derive `postedAt` from the supplied account:
  Draft produces `null`; Active retains the existing effective-date posting.
  Let `journalEntryEntity.make` derive journal status as it does today.
- Keep existing opening-date, account/control-account, equity-counterpart,
  currency, balancing, and accounting-period checks. This plan does not change
  their semantics or add a separate Draft opening-balance service.

### 3. Retain the transaction and suppress Draft accounting effects

- Bank and petty-cash creation remain the workflow owners. Prepare the journal
  and compute the existing `postedJournal` condition before invoking FX.
- Invoke `fxLotAppService.acquire` only for a Posted opening journal. For Draft,
  keep the acquisition result null, with no FX records or FX events to persist.
  Preserve the FX service's existing Draft guard without changing the service.
- Retain both Posted guards: no balance-propagation outbox record inside the
  transaction and no balance-adjustment queue submission after commit for Draft.
- Persist the Draft account, initial zero-balance record, applicable bank details,
  Draft journal/lines, and their histories in the same existing transaction.
  Ordinary account/journal creation events still publish after commit.
- Change the creation response helper to derive balances only from a Posted
  opening journal. Draft responses contain zero account and functional balances,
  while retaining the captured opening date and account status.

The use cases directly initiate `ledgerAccountPersistenceService.create`,
`bankAccountRepo.create` where applicable, and
`journalEntryPersistenceService.create`. The existing FX persistence and
propagation-outbox calls remain use-case initiated for Posted openings only.
No write moves into a domain or non-persistence application service.

### 4. Expose and verify the HTTP contract

- Regenerate TSOA routes/specification so existing endpoints accept the optional
  field and describe the restricted enum.
- Extend existing Supertest suites to verify Draft requests reach the existing
  use case and return the existing ledger DTO with Draft status.
- Verify omitted status retains Active behavior at the real domain/use-case
  boundary, not only in controller mocks.

## Test Plan

- **DTO validation:** In the five existing creation DTO test suites, accept
  Draft, Active, and omission; reject Archived/invalid status. Existing required
  fields and opening-data validation remain enforced.
- **Domain services:** Extend nearby tests for each changed factory to verify
  Draft status reaches the entity, created event, and audit; omission remains
  Active. Retain existing parent validation and demonstrate a valid Draft
  control parent with a Draft child using the current contract.
- **Opening journal:** In the existing journal-service tests, a complete Draft
  account with an initial opening balance produces a balanced Draft journal
  with `postedAt: null`, the supplied date, amounts, and exchange rate. Active
  openings remain Posted.
- **Use cases:** In the eight existing creation suites, verify status forwarding
  and persistence. For bank and petty cash, test Draft with/without opening
  balance and a foreign-currency Draft opening: account and journal writes use
  the same transaction, `acquire` is not called, FX persistence is not called,
  propagation outbox creation is not called, and queue submission is not called.
  Preserve the existing transaction failure and Active FX/propagation tests.
- **Response mapping:** Extend the existing helper suite to verify Draft openings
  return zero balances and Posted openings retain existing amounts.
- **HTTP:** Extend the eight existing creation endpoint suites under
  `test/http/ledger` to cover optional status acceptance, the returned Draft DTO,
  and rejection of unsupported status values. No browser tests are needed.
- **Database integration:** Extend the existing bank creation DB suite with one
  Draft opening case to verify stored Draft status, journal/lines and histories,
  zero balances, and absence of FX and propagation records. Use its existing
  disposable-database fixtures and cleanup; add no new harness.

Use existing typed shared mocks; keep domain tests within domain/shared imports.
Follow the [testing rules](../rules/testing/general.md) and maintain 100% coverage
for touched behavior. Do not redesign unrelated test fixtures.

## Verification

Start with the focused behavior suites, then run the other changed creation
families and HTTP boundaries. PostgreSQL is required only for the DB integration
suite, with `POSTGRES_URL` explicitly selecting an already migrated disposable
`*_test` database. Do not reset the development database.

```bash
npm run build:routes
npm test -- --runInBand --runTestsByPath \
  src/app/ledger/usecases/__specs__/create-bank-account.usecase.spec.ts \
  src/app/ledger/usecases/__specs__/create-petty-cash-account.usecase.spec.ts \
  src/domain/journal-entry/services/__tests__/journal-entry.service.test.ts \
  src/app/ledger/usecases/helpers/__specs__/map-ledger-account-to-dto.helper.spec.ts
npm test -- --runInBand src/app/ledger/dtos src/app/ledger/usecases src/domain/ledger/services test/http/ledger
npm test -- --config jest.db.config.js --runInBand --runTestsByPath test/db/ledger/bank-account-creation.db.spec.ts
npm run lint
npm run test:names
git diff --check
```

`npm test` includes the existing source/test type check. Run coverage for changed
implementations using the repository's coverage configuration. Inspect generated
diffs for only the intended optional creation fields; do not run production
source-map uploads for this change. If the disposable database is unavailable,
report its verification as outstanding.

## Completion Criteria

- All eight existing eligible creation APIs accept `status: 'draft'` with complete
  data and return the existing ledger response DTO containing Draft status.
- Omitted status and explicit Active retain existing behavior. Archived creation
  is not accepted.
- Draft accounts, events, and audits have the correct status from preparation.
- Provided bank/petty-cash opening balances persist as Draft journals with null
  posting dates in the existing account-creation transaction.
- Draft creation invokes no FX acquisition, persists no FX allocation records,
  and creates neither a propagation outbox record nor a propagation queue job.
- Draft account balances remain zero in persistence and the creation response.
- Relevant tests, coverage, generated contracts, and static checks pass.
- No activation, additional endpoints, or unrelated ticket behavior is added;
  prior staged and unrelated changes remain intact.
