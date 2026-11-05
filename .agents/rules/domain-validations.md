# Domain Validations And Helpers

Use explicit validation modules for reusable domain validity checks. Keep
helpers narrow and deliberate.

## Validations

- Entity validations live at
  `src/domain/<domain>/entities/validations/<subject>.validation.ts`.
- Value validations live at
  `src/domain/<domain>/values/validations/<subject>.validation.ts`.
- Domain-service validations live at
  `src/domain/<domain>/services/validations/<subject>.validation.ts`.
- Omit redundant `.entity`, `.value`, and `.service` segments from validation
  filenames.
- Default-export one frozen object containing the subject's validators. Do not
  add named exports.
- A validator answers a validity or case question. Both throwing assertions
  such as `validateStatus` and boolean predicates such as `isValidStatus` or
  `hasRequiredEffect` are validators. Throwing alone does not make a function a
  validator.
- Give every validation module a dedicated colocated test at
  `validations/__tests__/<subject>.validation.test.ts`.

## Helpers

- Reserve helper modules for getters, selectors, and derivations that do not
  own a separately named domain capability.
- Follow the cross-layer [Helper Rules](helpers.md) for module shape, naming,
  exports, and placement. Keep private implementation functions with their owner;
  do not manufacture helper modules for them.

## Dependency Direction

- Entity modules import their validation object and spread its validators into
  the frozen entity API. Helpers remain direct imports and are not re-exported
  through entity objects.
- An entity helper may import an entity validation directly.
- Entity helpers and entity validations must never import a composed entity
  module.
- Value-object modules import their validation object and spread its validators
  into the frozen value API. Value helpers remain direct imports and are not
  re-exported through value objects.
- Consumers import shared value validations directly when no owning value
  object exists.
- A value helper may import a value validation directly. Value helpers and
  value validations must never import the composed value-object module that
  consumes them.
- Domain services import their own service validation objects directly.
- Keep independently meaningful domain policies in `rules/` or domain services.

Follow [Folder Responsibility](folder-responsibility.md),
[Domain Modeling](domain-modeling.md), and [Readability](readability.md).
