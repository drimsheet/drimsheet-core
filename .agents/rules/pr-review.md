# PR Review

Review for bugs first.

Ground findings in concrete code paths, contracts, tests, or documented rules.
Missing ticket context is not itself a finding or a reason to stop reviewing.
Separate demonstrated defects from questions about unconfirmed product intent.

## Always Check

- Correctness regressions and missed edge cases.
- Security issues and secret exposure.
- Layer ownership and import boundaries.
- Import-path compliance with [Import Paths](import-paths.md).
- Repositories doing more than storage/retrieval.
- Domain or non-persistence application services invoking write repositories or
  persistence services instead of returning prepared results to a use case.
- Persistence services being invoked by anything other than a use case, or
  owning workflow decisions beyond their atomic write bundle.
- Controllers, middlewares, or use cases making hidden business decisions.
- Structural decisions without an explicit requirement or resolved plan
  decision, durable rule, concrete precedent, or explicitly approved deviation.
- Speculative behaviors, configuration, abstractions, compatibility paths, or
  hooks without a present consumer, as prohibited by
  [Scope And Simplicity](scope-and-simplicity.md).
- Undisclosed plan drift and material plan deviations that lack approval. Allow
  disclosed non-material corrections that preserve the approved outcome and
  scope.
- `any`, unsafe casts, dead code, magic strings, and duplicated logic.
- Missing or weak tests for changed behavior.

Report findings with severity, file, line, impact, and a concrete fix direction.
