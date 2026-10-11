---
name: entity-invariants-documentation
description: Use when writing or updating entity invariant documentation limited to core accounting, bookkeeping, and data-reliability principles. Includes entity descriptions, invariant tables, and optional standards references; excludes catalogues of validations, product policies, and implementation mechanics.
---

# Entity Invariants Documentation

## Load

- [Entity Invariants Documentation Rules](../../rules/entity-invariants-documentation.md)
- [Folder Responsibility](../../rules/folder-responsibility.md)
- [Scope And Simplicity](../../rules/scope-and-simplicity.md)

## Work

1. Read the domain's existing documentation and entity definitions to establish
   terminology, relationships, and scope. Inspect related behavior as needed;
   existing validators alone do not establish the intended contract.
2. Apply the writing rules' principle gate to every candidate invariant. Include
   only core accounting, bookkeeping, or data-reliability guarantees, expressed
   for the entity. Do not inventory field validations or reproduce its API.
3. Follow the table format, using the
   [accounting invariants](../../../src/domain/accounting/__doc__/invariants.md)
   only as a layout example. Existing rows must also pass the principle gate;
   their presence in a document does not establish eligibility.
4. Verify applicable primary references, preserve IDs for retained invariants, and
   check document links and entity coverage within the requested scope.
5. Link a new document from the domain's existing documentation index when one
   exists. Keep unresolved policy decisions and enforcement findings outside the
   entity document; documentation work does not authorize implementation fixes.
