# DTOs

DTOs define application input/output shapes.

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

- Before introducing a controller-local response type or returning a domain
  entity, search the owning application folder for an existing output DTO and
  mapper.
- Prefer the application-owned DTO and mapper at delivery boundaries. If the
  existing DTO is unsuitable, fix or intentionally replace the owning app DTO
  instead of duplicating its contract in the controller.
- Framework metadata limitations, including TSOA type resolution, are not by
  themselves a reason to duplicate a response contract.
- Keep assembly of balances, money, metadata, and other application output state
  in the application layer. Controllers should declare and return the DTO.
