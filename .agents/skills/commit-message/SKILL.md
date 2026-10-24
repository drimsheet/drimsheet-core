---
name: commit-message
description: Use when drafting or reviewing commit messages or pull request titles for this repository.
---

# Commit Message

Follow the format in [Commit Messages & Pull Requests](../../../CONTRIBUTING.md#commit-messages--pull-requests).

- Base the message on the supplied changes or diff. When asked for a message
  for staged changes, inspect `git diff --cached` and summarize only that scope.
- Choose the type that describes the change, using the repository's vocabulary:
  `feat`, `fix`, `chore`, `refactor`, `test`, or `doc`.
- Use either the affected domain or a known ticket ID in parentheses. The `|`
  in the format means either option; do not include it literally. If no ticket
  is provided, use the domain or affected area rather than inventing an ID.
- Write a short, lower-case description of the concrete change. Preserve a
  ticket ID's spelling when using it as the scope.
- When asked only for a message or title, return the proposed line without
  commentary. Drafting a message does not itself authorize a commit or PR.

Examples:

```text
feat(accounts): add account creation endpoint
fix(3442): correct ledger balance calculation
doc(agents): add commit message skill
```
