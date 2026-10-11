# Entity Invariants Documentation

Document only core accounting, bookkeeping, and data-reliability principles,
expressed as guarantees for each entity. This scope applies across domain folders,
including supporting entities such as counterparties. Keep
implementation evidence, enforcement locations, coverage gaps, and audit status
in plans or issues rather than in the invariant document.

## Principle Gate

Include a candidate only when all of these hold:

1. It protects a core accounting, bookkeeping, or data-reliability guarantee.
2. Its rationale names the concrete harm to financial meaning, record integrity,
   completeness, consistency, or traceability if the guarantee is violated.
3. It states the guarantee itself, independently of the current UI, API, storage
   representation, or enforcement mechanism.

Relevant guarantees include correct entity attribution, balanced recording,
consistent monetary measurement, preservation of referenced financial records,
traceable corrections, atomic changes, and prevention of lost or duplicate
financial effects. Include only those relevant to the entity; this is not a
checklist to reproduce under every section.

Exclude field lengths, formatting and normalization, enum catalogues, default
values, optional-field conventions, role-specific form requirements, request
replacement semantics, endpoint-specific transitions, no-op rejection, and
exact version/event/audit mechanics. These belong in their relevant contracts,
implementation, or tests. Labeling a detail "Drimsheet policy" or "structural
integrity" does not make it eligible.

For example, for a counterparty:

- Preserve the counterparty identity referenced by financial records: an
  eligible record-integrity guarantee.
- Keep changes traceable: an eligible data-reliability guarantee; do not prescribe
  exactly one audit row or a particular event payload in this document.
- Name length is 1–255, status defaults to Active, or version increments by one:
  excluded implementation/product details.

State an eligible guarantee precisely using the entity's relationships and
financial consequences. Do not replace implementation detail with a vague claim
such as "data must be reliable." Keep unresolved domain decisions outside the
normative table instead of inventing guarantees.

## Location And Structure

- Update the domain's existing invariant document when present. For a new one,
  use `src/domain/<domain>/__doc__/invariants.md`; respect an established
  `__docs__` directory or an explicitly requested filename.
- Begin with a brief scope statement, including framework applicability where
  relevant.
- Give each entity in scope one section: a short description of its business
  meaning, responsibility, and relationships, followed by an invariant table.
- Document shared rules once and link to them. A helper or alternate constructor
  does not require a separate entity section.

Use these columns:

| ID  | Invariant | Accounting basis / rationale | References (optional) |
| --- | --------- | ---------------------------- | --------------------- |

The References column is present; individual entries are optional and may use `—`.
An existing `Business basis / rationale` heading may remain, but does not broaden
the principle gate.

## Writing Rules

- Give each rule a stable, unique ID. Preserve IDs for retained rules; for new groups,
  follow the local pattern, such as `ACC-AP-001`. Do not renumber existing rules
  just to change their display order or reuse an ID for an unrelated rule.
  When revising a document, remove out-of-scope rows without reusing their IDs.
- State one independently testable obligation per row. Specify lifecycle timing,
  relationship scope, and exceptions where they affect the rule's meaning.
- Explain the core accounting, bookkeeping, or data-reliability principle behind
  the rule. Distinguish general principles from named framework requirements.
  Product policy alone is not a basis for inclusion, and must not be presented
  as accounting law.
- Ground accounting rules in the relevant accounting principles and standards.
  Current code is evidence of behavior, not proof of accounting correctness.
  Conversely, incomplete enforcement does not invalidate an established rule.
- State framework or jurisdiction conditions in the invariant itself when
  needed. Do not apply IFRS requirements universally to other frameworks.
- Keep uncertain proposals outside the normative table until resolved. Even an
  approved product policy must pass the principle gate to appear here.
- Add a short example or explanatory note only when a boundary or exception
  would otherwise be difficult to understand. Link general technical conventions
  instead of repeating them for every entity.

## References

- Prefer primary accounting standards or authoritative domain sources. Verify
  that each reference supports the specific rule; do not invent citations or
  attach a broad standard merely to lend authority to a product policy.
- Where a rule depends on a named standard, provide its supporting reference.
  Use a specific paragraph or section when available, and identify the edition
  and effective applicability when they affect the requirement.
- Optional references mean some rules need no external citation. They do not
  remove the need to substantiate a claim attributed to a particular standard.
- Use concise links in table cells. Put shared bibliographic or applicability
  details in a reference section rather than repeating them across rows.

## Verification And Maintenance

- Check that descriptions and terminology match the domain and every entity in
  scope is covered. Check IDs for uniqueness and links for valid targets.
- Review each row for a clear obligation, rationale, applicability, and accurate
  attribution. Keep enforcement/status/test-evidence columns out of the table.
- Apply the principle gate to every row, including existing examples. A document
  that inventories fields, enum values, or mutation mechanics fails this check
  even when it accurately describes the code.
- Follow [Domain Documentation](../../CONTRIBUTING.md#domain-documentation)
  when changing an established invariant alongside implementation work.
