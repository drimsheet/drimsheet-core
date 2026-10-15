# Domain Modeling

## Entity

Use an entity when the concept has identity and lifecycle.

- Has a stable unique ID.
- Owns invariant-preserving state transitions.
- Perform record updates through entity methods. A no-op returns the existing
  entity with no events or audit (`[entity, [], null]` for audited transitions).
- May emit domain events and audit records.
- Equality is based on identity.
- Examples: user, ledger account, journal entry, session.

### Unchanged Mutations

- Valid input that produces no business-state change must return the original
  entity reference, preserving its version and timestamps. Never throw solely
  because an update is unchanged, a value is already set to the requested value,
  or the requested transition has already been applied with identical details.
- Validate and normalize supplied values before comparing semantic state
  (including date values and nested metadata). No-op handling must not accept
  invalid input or conflicting changes to immutable fields.
- Return no events and no audit (`[entity, [], null]` for audited mutations).
  Never manufacture a version, timestamp, event, or history change to make an
  unchanged update look meaningful.
- Carry nullable audits through service contracts. Callers must skip persistence,
  history creation, event publication, and downstream work for unchanged state.
- Test empty and identical updates, normalized equivalent values, and repeated
  transitions. Assert reference identity, unchanged version/timestamps, no
  events/audit, and continued rejection of invalid or conflicting input.

## Value

Use a value when the concept is defined by its attributes.

- Has no independent lifecycle.
- Is immutable or treated as immutable.
- Validates a small domain concept.
- Equality is based on attributes.
- Examples: money amount, currency, email address, date range, token digest.

## Placement

- If it can be referenced independently by ID, model it as an entity.
- If changing an attribute makes it a different thing, model it as a value.
- Put aggregate state changes on entities or domain services.
- Put small reusable domain validation on values.
