# Reporting Use Cases

## Ownership and Layout

Reports belong to the namespace of the resource being reported on, not a
standalone `app/reporting` namespace. Account counterparty participation belongs
to ledger because it reports on an account selected by account ID.

Use one folder per report:

```text
src/app/<namespace>/usecases/reporting/<report>/
  <report>.usecase.ts
  dto.ts
  <report>.spec.ts
```

- Omit `get-` and `.reporting` from report folder and use-case filenames. Keep
  action names in factory and operation symbols, such as
  `makeGetBalanceHistoryByAccountUsecase`.
- `dto.ts` owns that report's named request/response types, validation schema,
  and named mapper when needed. Do not combine distinct reports into one DTO
  module or add a grouping folder solely to house their shared declarations.
- Combine use-case, DTO validation, and mapper tests in the sibling
  `<report>.spec.ts`; do not create separate test directories for those tests.
- Add `types.ts` or `error.ts` only when needed. Reuse existing errors with the
  correct semantics; do not create an error file or inheritance layer for
  symmetry. Preserve existing error keys during structural migrations.
- Shared use-case helpers belong in
  `src/app/<namespace>/usecases/helpers/reporting/`, with tests in its
  `__specs__/` directory. Do not create helper-only report folders.
- Reuse genuinely shared date handling and validation without merging otherwise
  independent report DTOs or workflows.

These are reporting-specific exceptions to the general use-case filename,
DTO placement/separation, test placement, and query-mock conventions. Other
layer and behavior rules still apply; see [Use Cases](usecase.md),
[DTOs](dto.md), and [Service Ownership](service-ownership.md).

## Query Boundary

- Define the report's read dependency in its use-case file as a function:
  `repoQuery: TGet<Report>RepoQuery`.
- Name exported shapes `IGet<Report>RepoQueryInput` and
  `IGet<Report>RepoQueryOutput`. The function accepts the input object and
  `IReadRepoOptions`, and returns a typed promise. Keep `IDependencies` private.
- Query output describes retrieved facts/aggregates, not serialized response
  DTOs. Keep application mapping and domain decisions out of SQL adapters.
- Implement the function under
  `src/infra/persistence/repos/<namespace>/queries/<report>.reporting.ts`,
  importing the consumer-owned contract as a type. Wire it through
  `src/infra/ioc/usecases/<namespace>.reporting.ts`.
- When multiple reports consume the same query, keep one capability-named
  function contract under `app/<namespace>/contracts/`, as with
  `TBalanceHistoryRepoQuery`. Do not duplicate the query or make one use case
  own its peers' shared contract.
- Define typed query-function mocks directly in the owning specs. Do not add
  a standalone file that only exports `jest.fn()`. Continue using existing
  shared mocks for other dependencies under the general testing rules.

## HTTP Delivery

- Use `<namespace>.reporting.controller.ts`, route `reporting/<namespace>`,
  and tags `Reporting` and `<Namespace> Reporting` (for example,
  `@Route('reporting/ledger')` and `@Tags('Reporting', 'Ledger Reporting')`).
- Keep route descriptions brief: purpose and essential caller-facing semantics.
  Keep implementation detail in use-case/query documentation; do not repeat
  generic error descriptions beside each response decorator.
- Put HTTP specs in `test/http/<namespace>/reporting/`. Follow
  [HTTP Integration](testing/http-integration.md) for filenames and structure,
  and [Controller Ordering](controller-ordering.md) for endpoint order.

## Current Examples

- [Account balance contributions](../../src/app/ledger/usecases/reporting/account-balance-contributions-by-counterparty/account-balance-contributions-by-counterparty.usecase.ts): consumer-owned query contract.
- [Balance history by account](../../src/app/ledger/usecases/reporting/balance-history-by-account/dto.ts): report-specific DTO and validation.
- [Balance helper](../../src/app/ledger/usecases/helpers/reporting/build-balance-history.helper.ts): shared helper placement.
