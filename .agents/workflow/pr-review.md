# PR Review Workflow

1. Read the review request and any provided ticket description, acceptance
   criteria, or relevant implementation plan. Revalidate plans against durable
   rules and current code.
2. If ticket context is missing and would help assess intended behavior, you may
   ask once for an optional ticket description. Continue investigating while
   awaiting a response; if none is provided or the user declines, complete the
   code review without it. Do not make ticket context a prerequisite.
3. Inspect the diff and build an understanding of the affected behavior beyond
   the changed lines: trace relevant callers, contracts, domain invariants,
   persistence and event flows, and tests. Read applicable domain documentation
   and compare established implementations in the codebase.
4. Review for correctness, security, architecture, and tests. When ticket context
   is available, also check the change against its requirements. Otherwise,
   assess regressions, edge cases, and consistency with the repository's
   documented rules and existing contracts. Distinguish inferred intent from
   confirmed requirements; do not invent acceptance criteria.
5. Lead with findings, ordered by severity.
6. Include file and line references.
7. Add open questions only when they affect correctness.
8. Keep summary brief. When no ticket description was available, note that
   requirement coverage could not be verified; still report the completed
   code-based assessment.

Follow `../rules/pr-review.md`.
