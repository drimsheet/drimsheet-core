# Atomic Receivable and Payable Control Setup Plan

## Goal

Extend `POST /api/v1/ledger/header-accounts/setup` to create the standard trade
and statutory receivable/payable control accounts in the same transaction as
the existing twenty header/equity accounts. Successful setup returns all
twenty-four accounts with their final codes and zero balances.

Update `GET /api/v1/accounts/recommended-bootstrap` so these mandatory controls
are no longer offered as accounts to create. Keep their optional statutory
default posting accounts as recommendations.

**Status: implemented without deviation; database verification unavailable.** This plan adopts
the user's decision to make the four controls part of foundational setup. It
uses the branch's current code-assignment persistence API, which supersedes the
earlier discussion of repository-reading sub-account factories. Preserve
unrelated staged and working-tree changes during implementation.

## Implementation Status

Baseline: no tracked source changes; this plan was already untracked. Preflight
confirmed the current domain and persistence contracts and found the existing
`test/db/ledger/ledger-code-assignment.db.spec.ts` PostgreSQL harness. Final
plan-to-diff reconciliation found no implementation deviations. All planned
source, generated API, and test changes are implemented.

| Slice and owner                                                 | Basis and precedent                                                          | Intended files/tests                                                         | Status                                                                                                                               |
| --------------------------------------------------------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Input aliases and nullable payable metadata (app/domain)        | Existing alias schema and nullable payable value objects                     | Header DTO/schema/tests; payable contract/domain tests                       | Implemented; focused tests passed                                                                                                    |
| Atomic structural control setup (app use case)                  | Existing setup; `createAndAssignCode`; `finalizeWithoutOpeningBalanceHelper` | Setup use case/specs, controller docs; composition and database verification | Implemented; orchestration/composition tests passed; PostgreSQL cases added but unavailable to run                                   |
| Optional-only recommendations (app)                             | Plan's responsibility change and existing grouped DTO                        | Recommendation use case/specs and HTTP spec                                  | Implemented; use-case and HTTP tests passed                                                                                          |
| HTTP/static validation and reconciliation (interface/generated) | Existing TSOA and test workflows                                             | Setup HTTP spec, generated output, focused tests, typecheck/lint             | Implemented; focused HTTP tests, route generation, typecheck, lint, and diff check passed; existing test-name failure recorded below |

Verification evidence:

- Initial DTO, payable domain, setup, and recommendation run: 4 suites / 96 tests
  passed. Final setup/recommendation, persistence/assignment, and HTTP run:
  6 suites / 72 tests passed. Both changed use cases have 100% statement, branch,
  function, and line coverage.
- `build:routes`, TypeScript test-project checking, lint, and `git diff --check`
  passed. Generated OpenAPI includes all four optional aliases and the updated
  twenty-four-account setup description.
- `test:names` reports the unchanged, tracked baseline file
  `src/infra/persistence/helpers/__tests__/get-db-query.test.ts`; it expects
  `__specs__/get-db-query.spec.ts`. No unrelated rename was made.
- Real PostgreSQL success and late-failure rollback tests were added to the
  existing isolated database suite and typechecked. They were not executed:
  `POSTGRES_URL` is unavailable, including through `.env.test`. The passing
  composition test does not establish PostgreSQL rollback or lock behavior.
- The response DTO does not expose account version or currency code. Tests
  verify those on domain/persistence/event/history state and verify final codes
  and paths on the response, preserving the existing public DTO contract.

## Current Context

- `makeSetupHeaderAccountsUsecase` currently prepares twenty audited accounts
  before opening one transaction. It calls
  `ledgerAccountPersistenceService.createWithoutAssigningCode` for each account,
  then publishes events after commit and returns `ILedgerAccountDto[]`.
- `IHeaderAccountNameAliasesReq` and its strict Zod schema support twenty optional
  translated names. The setup controller and its middleware already exist.
- `makeGetRecommendedBootstrapUsecase` currently owns static grouped arrays in
  TypeScript. Receivables and payables each contain trade/statutory control
  definitions, with one statutory default child. Plan changes against that
  implementation, not the earlier proposed JSON mapper.
- The current receivable/payable sub-account methods are synchronous. They
  accept a prepared `controlAccount` entity and return an audited account with a
  provisional code; they do not query the database to allocate final codes.
- `ILedgerAccountPersistenceService.createAndAssignCode` assigns the final code,
  persists the account and initial balance, and returns the final account plus
  assignment events. It joins the caller's transaction.

## Domain Language And Existing Guarantees

- **Header:** the existing root receivables (`102000`) or payables (`201000`)
  account. The four added accounts are child control accounts, not new root
  headers. Keep that distinction in internal variable names and tests.
- **Structural control accounts:** Trade Receivables, Statutory Receivables,
  Trade Payables, and Statutory Payables, all with `isControlAccount: true`.
- **Authoritative state:** the stored account, history, and balance records.
  Recommendation definitions remain static application data with no setup state.
- **Allocation guarantee:** `makeLedgerCodeAssignmentAppService.assign` locks the
  entity-scoped allocation header with `findByCodeForUpdate`, then reads the
  latest subtype code in a separate statement under the existing Read Committed
  contract. Assignment and insertion remain in the same transaction.
- **Storage guarantee:** account code and materialized path are unique per
  accounting entity; child accounts reference their parent through a foreign
  key. Initial balances are persisted in the same account bundle.
- **Audit/event guarantee:** callers supply creation histories and retain
  creation events. Assigning persistence appends the assignment history and
  returns assignment events. Publication happens only after the outer commit.
- **Repeat behavior:** existing header/equity checks reject repeated setup.
  Preserve this behavior; this operation does not repair partially configured
  existing entities or perform an upsert.

## Confirmed Findings

1. **Pure preparation can stay outside the transaction.** The current domain
   services accept the already prepared root header. Persisting a header first
   is necessary for locked allocation and foreign keys, not for domain creation.
2. **The new controls require assigning persistence.** Both sibling domain
   factories initially derive a code from the same header. Writing both through
   `createWithoutAssigningCode` would reuse a provisional code. Use
   `createAndAssignCode` sequentially instead.
3. **Stable setup order has existing domain constants.**
   `ASSET_LEDGER_CODES.RECEIVABLES` defines TRADE `102001` and STATUTORY `102002`;
   `LIABILITY_LEDGER_CODES.PAYABLES` defines TRADE `201001` and STATUTORY `201002`.
   Creating trade before statutory on each newly created root establishes these
   codes through the allocator. Do not manually overwrite domain entities.
4. **Payable metadata types need a narrow correction.** The domain value methods
   and payable entity types already permit null metadata; the two service input
   contracts still exclude it. Setup requires null metadata for the generic
   controls. Widen those inputs to their existing runtime semantics without casts.
5. **Dependencies are already wired.** Header setup already receives the
   receivable/payable domain services, persistence service, transaction service,
   context, and event bus. No new service or IoC dependency is required.

## Implementation Basis

| Decision or structural change                                     | Basis                                                           | Current requirement and production consumer                                | Evidence or rationale                                                                                                                                                       |
| ----------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add four controls to existing setup                               | User requirement                                                | Header-setup callers need a complete receivable/payable structure          | User accepted creation alongside headers; current `makeSetupHeaderAccountsUsecase` owns that workflow.                                                                      |
| Prepare using existing domain services and prepared root entities | Current contracts and ownership rules                           | Setup constructs valid controls without writes                             | `IReceivablesAccountService`, `IPayablesAccountService`; their service implementations validate parent/currency/metadata.                                                   |
| Use assigning persistence only for the four controls              | Existing contract, rule, precedent                              | Controls need final unique codes, paths, histories, and balances           | `createAndAssignCode`; `finalizeWithoutOpeningBalanceHelper`; `.agents/rules/service-ownership.md` explicitly permits locked assignment within this persistence capability. |
| One outer transaction owned by setup                              | Rule and existing workflow                                      | All twenty-four accounts must commit or roll back together                 | `.agents/rules/usecase.md`; `setup-header-accounts.usecase.ts`; persistence methods accept `repoOptions.tx`.                                                                |
| Extend existing flat alias DTO with four optional names           | Local precedent                                                 | Setup clients retain translation support for all accounts created by setup | `IHeaderAccountNameAliasesReq`, `headerAccountNameAliasesReqValidation`, and setup's `getCreationInput`.                                                                    |
| Return final assigned DTOs and publish both event sets            | Rule and current precedent                                      | Clients and subscribers must receive completed account state               | `finalizeWithoutOpeningBalanceHelper` uses the assigned result and preserves creation plus assignment events.                                                               |
| Remove mandatory control definitions from recommendations         | Accepted responsibility change and smallest coherent projection | Recommendation clients should create only optional accounts                | Existing grouped response already allows posting definitions as roots with `sub: []`; retain that shape and reference parents with existing code constants.                 |
| Allow nullable payable creation metadata                          | Confirmed domain semantics                                      | Generic payable controls have no counterparty/invoice or tax metadata      | `payablesMetaValue.makeTradeMeta`, `makeStatutoryMeta`, and payable account types.                                                                                          |

## Scope

### Expected Changes

- `src/app/ledger/usecases/setup-header-accounts.usecase.ts` — prepare controls,
  orchestrate both persistence methods, and return/publish assigned results.
- `src/app/ledger/dtos/header-account/header-account.dto.ts` and
  `header-account.dto.validation.ts` — four optional translated-name aliases.
- `src/domain/ledger/types/payables.service.types.ts` — explicitly nullable
  `meta` in trade and statutory creation inputs.
- `src/app/ledger/usecases/get-recommended-bootstrap.usecase.ts` — remove the
  four mandatory controls and promote their optional default children.
- `src/interface/http/controllers/ledger.controller.ts` — update setup's API
  description to include the standard receivable/payable controls.
- Existing DTO, domain-service, setup use-case, recommendation use-case, and
  HTTP specs — cover the extended behavior and revised recommendation payload.
- `generated/` — regenerate TSOA for the additional optional request fields and
  changed operation documentation.

### Out of Scope

- Additional POST endpoints, generic bulk creation, and changes to bank/petty
  cash, revenue, expense, suspense, or accounting-entity creation workflows.
- Automatically creating either statutory default posting account during setup.
- New code allocators, locks, persistence services, domain factories, repository
  methods, configuration, or transaction abstractions.
- Removing old bootstrap services or restructuring the recommendation DTO family.
- Backfilling existing entities, migrations, idempotent setup, or retry workers.
- Rewriting the recommendation implementation to load JSON or adding dynamic
  entity-specific recommendation lookups.

## Proposed Approach

### 1. Extend the setup input and prepare the four controls

Add these optional aliases, with the same name validation and defaults as the
existing setup fields:

| Alias                   | Default name          |
| ----------------------- | --------------------- |
| `trade_receivables`     | Trade Receivables     |
| `statutory_receivables` | Statutory Receivables |
| `trade_payables`        | Trade Payables        |
| `statutory_payables`    | Statutory Payables    |

These are alias keys, not new domain subtypes. Rename the private alias helper's
`subType` parameter to `aliasKey` if it is extended to cover these keys. Preserve
the existing twenty aliases and support for omitted body or `{}`.

Retain explicit references to the prepared receivables and payables root headers
while building the current header collection. Do not find them by translated
name, assume a fragile array index, or read them back from the database.

Use the existing family methods to prepare the controls:

- Receivable trade and statutory controls both use the entity's functional
  currency and the prepared receivables root as `controlAccount`.
- Payable trade and statutory controls both use the prepared payables root and
  `meta: null`. Trade retains its domain-owned null currency; statutory uses the
  entity's functional currency.
- All four use `isControlAccount: true` and the context actor/entity. Names use
  the supplied aliases or English defaults.

Correct `ITradePayload.meta` and `IStatutoryPayload.meta` to include `null`.
Keep the current value-object validation for non-null metadata unchanged.

Prepare creation histories before opening the transaction. Keep each control's
audited state associated with its allocation root code and creation events.
Domain services continue to own account validity; the use case owns this fixed
workflow and write ordering. No new service is needed.

### 2. Persist all twenty-four accounts atomically

Keep one outer `repoService.runInTransaction` in the setup use case:

1. Persist the twenty prepared header/equity accounts through
   `createWithoutAssigningCode`, preserving their existing codes and order.
2. Call `createAndAssignCode` sequentially for Trade Receivables, Statutory
   Receivables, Trade Payables, and Statutory Payables, passing the same `tx`,
   correlation ID, creation history, actor ID, and functional currency.
3. Use the corresponding root header code as `allocationHeaderCode`, not a
   provisional child code. Roots are now visible within the transaction and
   each assignment sees the preceding sibling's insert.
4. Return the assigned account/event results from the transaction. Propagate
   any failure so all headers, controls, histories, and balances roll back.

Every persistence invocation originates directly in this use case. The existing
persistence service internally writes account/history/balance records and adds
assignment history; do not duplicate those writes or manually invoke the
assignment service. Do not call the single-account finalization helper inside
this workflow, because it also owns publication.

After successful commit, publish one enriched event collection containing the
twenty header creation events and each control's creation and assignment events.
Preserve event ordering per account: creation before assignment. Keep existing
post-commit failure semantics; do not claim event publication failure rolls back
committed accounts.

Return the existing twenty DTOs in their current order followed by the four
control DTOs in persistence order. Map the returned assigned entities, not the
provisional prepared versions. The account IDs, final codes, paths, versions,
and zero-balance DTOs must agree with persisted state.

### 3. Update recommendations to match setup ownership

Keep the existing five group keys and DTO shapes. Remove `trade-receivables`,
`statutory-receivables`, `trade-payables`, and `statutory-payables` from the
recommendation definitions.

Promote the two remaining statutory default posting definitions into the root
of their respective groups, each with `sub: []`:

- `statutory-receivables-default` uses
  `controlAccountCode: ASSET_LEDGER_CODES.RECEIVABLES.STATUTORY`.
- `statutory-payables-default` uses
  `controlAccountCode: LIABILITY_LEDGER_CODES.PAYABLES.STATUTORY` and retains
  `meta: null`.

Remove those leaves' `controlAccountKey` fields because the corresponding
definitions are no longer part of the recommendation response. Reuse the domain
constants rather than new numeric literals. This relies on the standard fresh
setup order verified above; recommendations do not resolve arbitrary legacy
charts or discover persisted account IDs.

Resulting counts are `[1, 1, 6, 8, 2]`, eighteen optional posting definitions.
Revenue, expense, suspense, synchronous GET behavior, and GET access middleware
remain unchanged. No marker fields or duplicate parent group definitions are
needed to distinguish mandatory accounts from optional ones.

## Test Plan

- **Alias DTO tests:** accept the four new optional fields, preserve all existing
  aliases, and reject invalid names/unknown fields using existing error keys.
  Tests must not equate alias keys with domain subtypes.
- **Payables domain tests:** call the real trade/statutory methods with typed
  `meta: null`; retain non-null metadata validation and parent/currency checks.
- **Setup orchestration specs:** assert twenty predefined writes followed by
  four assigning writes, one outer transaction, common transaction/correlation
  context, correct allocation roots and actor, correct parents/currencies, and
  default/translated names. Use existing typed shared mocks.
- **Assigned-result regression:** have persistence return different final codes,
  paths, and versions from the prepared controls; assert the response uses those
  results and publishes assignment events along with creation events only after
  commit. Retain creation histories and let persistence own assignment history.
- **Failure coverage:** preparation failure before any write; root persistence
  failure; failure during each of the four control writes; outer commit failure;
  existing header/equity conflict; post-commit publication failure. Failed writes
  must not publish events or return success. Repeat setup retains conflict
  semantics and does not create additional controls.
- **Real allocation composition:** exercise actual domain factories, assigning
  persistence, and assignment service with a test-local transactional repository
  fake to prove trade/statutory siblings receive distinct codes and the standard
  constants. Verify final balance paths and both history records per control.
  A fake proves composition, not PostgreSQL rollback or lock isolation.
- **Database verification:** on an isolated test database, run fresh setup and
  inspect all twenty-four accounts, parent IDs, histories, and balances. Inject
  a late control-persistence failure in a separate setup and verify none of that
  transaction's rows remain. Use an existing database harness if available;
  otherwise record this as an infrastructure-dependent verification step rather
  than introducing a new general-purpose harness in this change.
- **Recommendation specs:** assert the four controls are absent, all eighteen
  optional definitions remain, group counts are `[1, 1, 6, 8, 2]`, no dangling
  `controlAccountKey` exists, and statutory parent codes match completed setup.
- **HTTP specs:** update setup success/default/translation assertions for
  twenty-four accounts; preserve 401/403/409/422/error behavior. Update GET
  response assertions for the revised recommendations. Retain successful GET
  without entity selection and existing `sub` array response conventions.

## Verification

```bash
npm test -- --runInBand src/app/ledger/dtos/header-account/__tests__/header-account.dto.validation.test.ts src/domain/ledger/services/liability-account/__tests__/payables.service.test.ts
npm test -- --runInBand src/app/ledger/usecases/__specs__/setup-header-accounts.usecase.spec.ts src/app/ledger/usecases/__specs__/get-recommended-bootstrap.usecase.spec.ts src/app/ledger/services/__specs__/ledger-account-persistence.service.spec.ts src/app/ledger/services/__specs__/ledger-code-assignment.service.spec.ts
npm run build:routes
npm test -- --runInBand test/http/ledger/setup-header-accounts.post.spec.ts test/http/ledger/get-recommended-bootstrap.get.spec.ts
npm run test:names
npx tsc --noEmit -p tsconfig.test.json
npm run lint
git diff --check
```

Inspect generated OpenAPI for the four optional aliases and setup description.
Ensure the existing persistence/assignment specs still verify transaction joining
and allocation locking. Database verification requires isolated PostgreSQL and
valid seed context; never reset an existing environment to satisfy it. Report
unavailable infrastructure or unrelated baseline failures explicitly. For this
plan-only task, only document formatting and diff checks are run.

## Risks

- **Public response change:** setup returns twenty-four instead of twenty
  accounts; recommendation receivable/payable groups now contain one posting
  definition each. Clients that assume old counts or parent wrappers must update
  alongside this change; describe the new contract in API documentation.
- **Existing partial setup:** entities created by older header-only setup remain
  without the new controls, and retrying setup still conflicts. This plan applies
  to fresh setup. Existing-data repair requires a separate explicit rollout/data
  decision if such entities need support.
- **Provisional state leakage:** ignoring assigning persistence's returned state
  would expose incorrect codes/paths/versions. Make that a focused regression test.
- **Static parent references:** recommendation constants are correct for the
  standard fresh setup; they are not a lookup mechanism for custom legacy charts.
  Verify the constants against the composed setup flow.
- **Event delivery:** publication remains after commit and may fail independently.
  Preserve the current event contract without adding blind retries or duplicate
  account creation.

## Completion Criteria

- Header setup commits the existing twenty accounts and all four standard
  controls together, or commits none of them on preparation/persistence failure.
- Controls reference the correct root IDs; trade precedes statutory allocation
  and produces the existing domain code constants for fresh setup.
- Histories, balances, response DTOs, and events follow the current assigning
  persistence contract; events publish only after commit.
- All twenty-four created accounts support translated names through the existing
  optional alias mechanism.
- Recommendations contain eighteen optional posting definitions and no mandatory
  control definitions or unresolved references to removed recommendation keys.
- Focused tests, route generation, and static checks pass, with database evidence
  recorded separately and any unavailable verification explicitly disclosed.
- No unrelated account workflows, persistence guarantees, or working-tree edits
  are changed.
