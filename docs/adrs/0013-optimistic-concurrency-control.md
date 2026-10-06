# ADR 0013: Optimistic Concurrency Control

## Status

Superseded by ADR 0019

## Context

Financial accounting systems require robust protections against concurrent modification to preserve data integrity. Because Drimsheet's primary interaction model is a disconnected HTTP web interface (a stateless environment), traditional pessimistic database row locks (`SELECT ... FOR UPDATE`) cannot be utilized to protect user-driven interactions spanning minutes.

If we rely on standard "last-writer-wins" database operations without locks, we expose the system to the **Lost Update Problem**. For example, Accountant A and Accountant B both open a Category edit view simultaneously. Accountant B saves an update. Two minutes later, Accountant A saves their update using their stale browser state, silently overwriting Accountant B's intermediate work.

Furthermore, automated background workers (e.g., balance recalculators) may modify entity state dynamically. A mechanism is required to guarantee that human users do not overwrite system-calculated states with outdated form POST payloads.

## Decision

We will standardize on **Optimistic Concurrency Control (Versioning)** for human-mutated aggregate roots.

1. High-contention entities (e.g., `JournalEntry`, `Category`) will include a `version: number` scalar.
2. Every successful database mutation of these entities will increment their version by strictly `+1`.
3. The core `IRepoOptions` interface has been extended with an `expectedVersion?: number` property.
4. Application services handling user operations will pass the client-provided version to the repository. The underlying database adapter will explicitly attach `AND version = expectedVersion` to the `UPDATE` query.
5. If the update query resolves with `0 rows affected`, the repository will proactively throw a framework-level concurrency exception, prompting the client UI to reject the save and instruct the user to refresh their view.
6. Automated background workers are explicitly permitted to use Pessimistic Row Locking concurrently for millisecond-duration critical sections, seamlessly complementing the versioning mechanism.

## Consequences

### Positive

- Completely eliminates the "Lost Update Problem" for business users interacting statelessly over HTTP.
- Zero performance/scaling overhead on READ operations, as no database locks are held during user delays.
- Cleanly protects financial documents from race conditions without complex locking logic in the application layer.

### Negative

- Clients/Frontends are now obligated to pass current entity versions back to the server on mutation requests.
- Adds occasional friction for end-users who collide during edit sessions, forcing them to refresh and redo their modifications.
- Imposes an explicit requirement on all Database Repository implementations to manually intercept and apply the `expectedVersion` condition natively (e.g., in Drizzle ORM blocks).
