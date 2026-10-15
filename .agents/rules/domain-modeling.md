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
