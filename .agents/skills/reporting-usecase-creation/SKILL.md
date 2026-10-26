---
name: reporting-usecase-creation
description: Use when creating, changing, or reorganizing reporting use cases and their DTOs, read queries, tests, wiring, or HTTP endpoints. Does not cover accounting reporting-period or reporting-context management.
---

# Reporting Use Case Creation

## Load

- [Reporting Use Cases](../../rules/reporting-usecases.md)
- [Pair Programmer](../pair-programmer/SKILL.md) for implementation
- [Testing](../testing/SKILL.md) for test changes

## Work

- Identify the report's owning namespace and inspect a current report there.
- Apply the reporting layout and query boundary before introducing files.
- Keep report-specific contracts and tests with their use case; share only
  capabilities with actual consumers.
- Verify the owning use-case, query, and HTTP tests. Regenerate TSOA artifacts
  when controller or DTO metadata changes, checking routes and response shapes.
