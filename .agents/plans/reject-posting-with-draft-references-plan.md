# Reject Posting With Draft References Plan

## Goal

Reject payment, receipt, and transfer posting when any referenced ledger account
is Draft, including posting through the existing rectification workflow.
Preserve the existing equivalent rule for Draft counterparties. Draft journals
may continue to reference Draft accounts and counterparties, and Draft opening
balances must remain supported.

Implementation-ready. Preserve the existing staged implementation of the status
and creation-API plans and all other unrelated changes. This plan adds the missing
journal validation; it does not replace those plans.

## Context

- The user asked whether non-Draft journals are prevented from referencing Draft
  ledger accounts or counterparties, then requested a plan to close the gap.
- Repository inspection and an in-memory reproduction confirmed that
  `journalEntryService.createPayment` currently prepares a Posted journal with a
  Draft expense account. No database records were created by that reproduction.
- The existing Draft-counterparty validation already rejects posting, and its
  focused payment, receipt, and transfer tests passed during the assessment.
- Opening-balance preparation now uses a null posting date for a Draft account.
  This behavior must be preserved.

## Domain Language And Existing Guarantees

- **Authoritative state:** Referenced domain accounts and counterparties carry
  their statuses. Journal preparation uses `header.postedAt`: null means Draft;
  a date means posting. `journalEntryEntity.make` derives status from that value.
- **Domain terms:** This change guards creation/posting of Posted journals.
  Archived, never-posted journals may retain Draft references under the user's
  previously agreed rule; archiving behavior remains unchanged.
- **Existing guarantees:** Use cases initiate persistence. Domain journal
  services perform validation and return prepared entities. Creation use cases
  validate before journal persistence and FX preparation. Rectification prepares
  the requested source journal before rectification, FX effects, and writes.
  Existing transaction and expected-version guarantees remain intact.

## Confirmed Findings

1. `validateAccounts` in
   [`journal-entry.validation.ts`](../../src/domain/journal-entry/services/validations/journal-entry.validation.ts)
   currently checks accounting-entity ownership, control-account exclusion,
   opening dates, and currency compatibility. It neither receives `postedAt`
   in its declared header contract nor checks account status.
2. `createPayment`, `createReceipt`, and `createTransfer` all call this shared
   validator with the full header and all applicable source/destination accounts.
   Extending this validator covers those existing production paths without new
   use cases or duplicated checks.
3. `validateCounterparties` returns for Draft journals and throws
   `DraftCounterpartyNotAllowed` for posting with a Draft counterparty. Source
   counterparties are prohibited on transfers by existing composition rules;
   permitted destination/charge counterparties are validated.
4. Opening-balance preparation also calls `validateAccounts`, but builds a
   header containing only accounting entity and effective date. It must pass
   the same resolved posting date used to create the opening journal.
5. `journalEntryRectificationPreparationService` calls the same payment,
   receipt, or transfer domain service. Its `getHeader` uses the requested
   posting date for Draft originals and retains the posting date for Posted
   originals. The shared guard therefore applies to Draft-to-Posted updates and
   corrections introducing Draft references.
6. `journal-entry.error.ts` owns the existing mapped domain errors. HTTP delivery
   maps an `_invalid` suffix to 400 and returns the error key and cause through
   the existing error parser. No new response envelope is needed.

## Implementation Basis

| Decision or change                                   | Basis                                                           | Current requirement and production consumer                                | Evidence or rationale                                                                        |
| ---------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Extend shared account validation with posting intent | Explicit user requirement; existing domain-validation ownership | Reject posting through payment, receipt, transfer, and rectification paths | `journalEntryServiceValidation.validateAccounts`; concrete parallel `validateCounterparties` |
| Add a journal-owned Draft-account error              | Existing context-owned error pattern                            | Callers must understand that account activation is required before posting | `journalEntryError.DraftCounterpartyNotAllowed`; error-handling rules                        |
| Pass resolved posting intent for opening balances    | Existing Draft-opening requirement                              | Both opening-balance service methods use the same preparation              | `prepareOpeningBalance`, `createInitialOpeningBalance`, `createOpeningBalance`               |
| Reuse existing rectification and HTTP error paths    | Existing local precedent; scope-and-simplicity rule             | Posting/correction requests must reject consistently                       | `getHeader`, `prepareSourceJournalEntry`, and existing HTTP Draft-counterparty error tests   |

No service, repository operation, persistence boundary, IoC dependency, or
coordination mechanism is introduced.

## Scope

### Expected Changes

- `src/domain/journal-entry/errors/journal-entry.error.ts` — add
  `DraftLedgerAccountNotAllowed` with key
  `journal_entry_error_draft_ledger_account_not_allowed_invalid`.
- `src/domain/journal-entry/services/validations/journal-entry.validation.ts` —
  include `postedAt` in the account-validation header contract and reject Draft
  accounts only when posting is requested.
- `src/domain/journal-entry/services/journal-entry.service.ts` — compute the
  opening journal's posting date once and pass it to both account validation
  and journal entity creation.
- Existing domain validator and journal-service tests — cover Draft account
  acceptance/rejection and retain Draft-counterparty coverage.
- Existing rectification preparation and journal creation/rectification use-case
  tests — verify effective posting intent and error propagation before writes.
- `test/http/journal-entry/{create-payment,create-receipt,create-transfer,rectify-journal-entry}.post.spec.ts`
  — extend the existing 400 cases to cover the new account error and its cause.

### Out of Scope

- Activation, account/counterparty status transitions, selectors, or UI work.
- New APIs, migrations, database status constraints, or persistence-layer
  business validation.
- Altering the existing counterparty rule, introducing combined error aggregation,
  or changing unrelated error precedence.
- Changes to journal archiving, historical data repair, or accounting-period,
  FX, and balance-propagation implementation.
- New locks, workers, or transaction mechanisms.

## Proposed Approach

### 1. Add the account guard at its existing domain owner

- Extend `validateAccounts`' header `Pick` to include `postedAt` as a required
  field. All callers must provide the actual posting intent.
- Retain the current ownership, control-account, date, and currency checks for
  both Draft and Posted journals. Do not return before those checks for Draft.
- For non-null `postedAt`, collect referenced accounts whose status equals
  `ELedgerAccountStatus.Draft` and throw `DraftLedgerAccountNotAllowed` if any
  are present. Apply the check to all journal lines, on either side.
- Follow the counterparty-error precedent with cause data
  `{ accounts: [{ id, name }] }`, containing the blocking accounts. Document the
  client-facing meaning alongside the key: activate the ledger account before
  posting. Keep human-facing translation outside this backend change.
- Retain `validateCounterparties` unchanged. Both guards reject posting without
  silently changing the requested journal to Draft.

### 2. Keep opening balances consistent

- In `prepareOpeningBalance`, resolve `postedAt` from the supplied account status
  once: Draft yields null; the existing Active path yields `effectiveDate`.
- Include that value in `headerValidationPayload` and use it when making the
  journal. Do not add a separate opening-balance validation path.
- Draft opening journals remain valid and retain their amounts/date. Existing
  account-creation guards continue to skip FX allocation and propagation for
  those journals.

### 3. Verify existing callers and failure boundaries

- Payment, receipt, and transfer already pass their full headers; retain their
  shared validator calls and avoid adding copies of the rule in use cases,
  controllers, or repositories.
- Retain rectification's effective posting date. A Posted original cannot avoid
  validation by supplying `postedAt: null` in the correction request, because
  `getHeader` retains its original posting date.
- Verify domain failures propagate before journal writes, FX preparation/write
  bundles, propagation outbox creation, and queue submission. Use cases remain
  the sole initiators of persistence; no persistence call changes owner.
- Reuse the existing HTTP domain-error mapping. No controller decision or
  generated route contract change is required for a new error key using the
  existing response DTO.

## Test Plan

- **Shared validator:** Extend
  `services/validations/__tests__/journal-entry.validation.test.ts` with valid
  entity-factory fixtures. Draft accounts are accepted when `postedAt` is null
  and rejected when it is a date, on source and destination lines. Verify the
  error key/cause and that Active accounts still pass. Update existing test
  headers for the new required field. Existing non-status validations must still
  reject invalid Draft journals.
- **Domain service:** Extend
  `services/__tests__/journal-entry.service.test.ts` for payment, receipt, and
  transfer: Draft references can produce Draft journals but cannot produce Posted
  journals. Include the previously reproduced payment with a Draft expense
  destination as a regression. Retain existing Draft-counterparty tests and
  Active posting tests. Confirm Draft opening balances still produce Draft
  journals through both existing opening methods.
- **Rectification:** Extend the preparation suite to verify effective posting
  intent is forwarded for the supported source types. Include a focused case
  using the real journal domain service with existing typed port mocks to confirm
  rejection when posting a Draft original or introducing a Draft reference into
  a correction of a Posted original. Exercise both the new account error and
  existing counterparty error without duplicating domain logic in the app.
- **Use-case failure handling:** Extend the existing creation and rectification
  suites with domain rejection cases. Assert no journal persistence, FX effects,
  propagation outbox records, queue jobs, or success events are initiated after
  rejection. Retain current transactions and failure handling.
- **HTTP:** Add the account error to existing 400-response suites, checking its
  key and blocking-account cause. Preserve the existing Draft-counterparty
  error cases. These HTTP tests verify mapping; domain/service tests verify the
  business rule.
- **Regression:** Run the bank/petty-cash creation suites to preserve Draft
  opening behavior with no FX allocation or propagation. No new browser or
  database test harness is required for this domain validation change.

Follow existing [testing rules](../rules/testing/general.md), use typed shared
mocks outside domain tests, and maintain 100% coverage for touched behavior.

## Verification

Run focused suites first, then the related creation/rectification and HTTP
boundaries. The checks below use the existing test mocks and do not require a
live database or frontend repository.

```bash
npm test -- --runInBand --runTestsByPath \
  src/domain/journal-entry/services/validations/__tests__/journal-entry.validation.test.ts \
  src/domain/journal-entry/services/__tests__/journal-entry.service.test.ts \
  src/app/journal-entry/services/__specs__/journal-entry-rectification-preparation.service.spec.ts
npm test -- --runInBand src/app/journal-entry/usecases test/http/journal-entry
npm test -- --runInBand --runTestsByPath \
  src/app/ledger/usecases/__specs__/create-bank-account.usecase.spec.ts \
  src/app/ledger/usecases/__specs__/create-petty-cash-account.usecase.spec.ts
npm run lint
npm run test:names
git diff --check
```

`npm test` includes the source/test type check. Run focused coverage using the
repository's configuration for changed domain behavior. Review the final diff
against the existing staged baseline; do not regenerate unrelated artifacts.

## Completion Criteria

- Posting a payment, receipt, or transfer with a Draft ledger account fails with
  the new journal-owned domain error, identifying the blocking accounts.
- Posting with a Draft counterparty continues to fail with its existing error.
- Existing rectification cannot post a Draft journal or prepare a Posted
  correction using Draft accounts or counterparties.
- Valid Draft journals and Draft opening balances remain accepted.
- Rejected requests persist no journal/FX/propagation bundle and enqueue no
  balance propagation; existing Active posting behavior remains intact.
- Relevant tests, touched-behavior coverage, type checking, and static checks
  pass. No unrelated behavior or prior staged changes are modified.

## Implementation Status

Preflight complete: current callers, opening preparation, rectification posting
intent, and error mapping match the plan. Existing staged changes are preserved.
No deviations are required.

| Slice and owner                          | Basis and intended files                                                                               | Status and verification                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Posting guard — journal domain           | `validateCounterparties` precedent; journal error, validator, and opening preparation listed above     | Implemented; focused type check and domain suites passed, including both opening methods                                             |
| Failure boundaries — journal application | Existing preparation and use-case ordering; rectification preparation and creation/rectification specs | Complete; real-domain rectification and use-case rejection tests passed before journal, FX, outbox, queue, and success-event effects |
| Error delivery — HTTP                    | Existing Draft-counterparty 400 mapping; four HTTP suites listed above                                 | Complete; account key/cause and existing counterparty mapping tests passed                                                           |
| Regression and completion                | Plan verification and existing Draft opening requirements                                              | Complete; focused coverage, related suites, type check, lint, naming, diff and staged-baseline checks passed                         |

Implemented without deviation. Verification:

- Focused validator, journal service, and rectification preparation: 3 suites,
  116 tests passed. Both opening-balance methods retain Draft support.
- Journal use cases plus bank/petty-cash regressions: 12 suites, 156 tests passed.
- Journal HTTP boundary: 8 suites, 78 tests passed. Supertest's local listener
  required an approved run outside the sandbox after the sandbox returned EPERM.
- Focused coverage: journal service and validator each have 100% statements,
  branches, functions, and lines.
- Source/test type checking, lint/import rules, test naming, and diff whitespace
  checks passed. The existing staged diff is unchanged (SHA-256:
  `897131578ca0c1a625102b05de3b8eacc925b1b06354f93aae40b5e37c11f7a3`).
- All completion criteria are satisfied; no production changes outside the three
  planned journal-domain files, and no unrelated artifacts regenerated.
