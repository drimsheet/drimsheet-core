# DTOs

DTOs define application input/output shapes.

For reporting DTO placement and colocation, use the exception in
[Reporting Use Cases](reporting-usecases.md).

## Rules

- Place DTOs under `src/app/<domain>/dtos`.
- Keep each DTO concern in its own sibling file:
  - `<resource>.dto.ts` owns TypeScript DTO types and interfaces.
  - `<resource>.dto.validation.ts` owns Zod schemas and field validators.
  - `<resource>.dto.mapper.ts` owns DTO mapping when conversion is needed.
- Do not export validation schemas or mapping behavior from a `.dto.ts` file.
- Name query validators after the application operation, using
  `<operation><Resource>QueryValidationSchema` (for example,
  `getCounterpartiesQueryValidationSchema`).
- Compose validation schemas from existing validators without mutating shared
  schema shapes.
- Use domain/app error keys in validation messages.
- Validation-message keys identify individual invalid fields. The interface
  validation envelope owns the top-level `_validation_error` key and HTTP 422.
- Provide `fromDto` / `toDto` helpers in the DTO mapper when conversion is
  needed.
- Do not use `any`.
- Do not expose persistence versions or accept expected versions in delivery DTOs without an accepted stale-view contract.

DTO validation is for transport shape and primitive constraints. Business validity belongs in domain/app logic.

## HTTP Outputs

- Before introducing an output type, inspect the existing domain type and
  application output contracts.
- Return the domain type directly when its full shape is the intended output,
  including when nested in an application response. Do not create duplicate
  output interfaces, aliases, or pass-through mappers for the same shape.
  Compile-time brands such as UUID brands do not justify a separate output DTO.
- Create an application-owned output DTO and mapper when the response adds,
  omits, or transforms fields, or has a current requirement for an independently
  maintained contract. Hypothetical future divergence is not sufficient.
- Direct returns expose runtime properties, not just declared TypeScript fields.
  Keep entity construction and persistence-to-domain mapping aligned with the
  domain type; remove unintended runtime extras at their owner.
- Framework metadata limitations, including TSOA type resolution, are not by
  themselves a reason to duplicate a response contract.
- Keep assembly of balances, money, metadata, and other application output state
  in the application layer. Controllers should declare and return the selected
  domain type or application DTO without duplicating it locally.
