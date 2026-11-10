# Helpers

These rules apply to every layer: domain, app, interface, infra, and shared.

## Module Shape

- Each helper module must default-export exactly one function. Do not add named
  exports, re-exports, or helper wrapper objects, including frozen objects.
- Use `<subject>.helper.ts` for standalone helper files, never `.helpers.ts`.
- Give the function an explicit subject-specific name ending with `Helper` that
  remains clear at the call site; do not rely on its file path for context.
- Keep private implementation functions and types with their owner. They do
  not count as additional exported helpers. TypeScript overload signatures for
  the same function are allowed.
- Import helpers directly from their owning module rather than re-exporting
  them through another API.

## Placement

- Keep helpers with the component that owns their behavior, such as
  `src/app/<namespace>/usecases/helpers` or
  `src/domain/<namespace>/entities/helpers`. They may also live alongside their
  owner without a separate helper directory.
- Do not create helper directories directly under business namespaces, such as
  `src/app/journal-entry/helpers` or `src/domain/ledger/helpers`. Namespace roots
  are the business modules under `src/app` and `src/domain`, including
  journal-entry, ledger, and counterparty.
- Technical folders such as persistence, observability, HTTP, and MCP are not
  business namespaces. Their helper directories, including
  `src/infra/persistence/helpers`, remain allowed. `src/shared/helpers` is also
  allowed.
- Helpers retain their layer's dependency restrictions. Shared helpers must
  remain pure and framework-neutral.

ESLint enforces the export shape and naming for `*.helper.ts`, `*.helpers.ts`, and
production TypeScript modules in `helpers` directories, plus the business
namespace directory restriction. Mapper, test, and mock modules are excluded
from helper-module checking; a mapper remains a mapper when colocated in a
technical helper directory.

Follow [Folder Responsibility](folder-responsibility.md),
[Readability](readability.md), and [Import Paths](import-paths.md).
