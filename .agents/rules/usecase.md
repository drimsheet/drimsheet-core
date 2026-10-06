# Use Cases

## Naming

- File: `<action>-<resource>.usecase.ts`.
- Factory: `make<Action><Resource>Usecase`.
- Return an anonymous async executor.

## Rules

- Use dependency injection unless calling another use case.
- Depend on interfaces/contracts, not implementations.
- Validate executor input with DTO schemas and `zodValidationRunner`.
- Orchestrate the request workflow, including repository writes, transactions,
  history creation, context updates, and event publication when they are
  specific to that workflow.
- Be the sole initiator of persistence. Call repositories directly for simple
  writes or call a dedicated persistence service for an atomic multi-repository
  bundle. Do not delegate the decision to persist to another domain or
  application service.
- Own the outer workflow transaction and pass it to every persistence call that
  must commit or roll back with the request.
- Derive `expectedVersion` from the workflow's repository read.
- Do not hide business rules in the use case body.
- Move non-trivial decisions to domain entities, values, domain services, app services, or app policies.
- Do not extract a service only to shorten the use case.

## Persistence Services

- A persistence service is a narrowly named write capability invoked directly
  by a use case.
- It may compose repository writes and enforce structural or storage-level
  invariants needed to keep the persisted bundle coherent.
- It may join the caller's transaction or create the local transaction required
  to make its own write bundle atomic.
- It must not decide whether the workflow should persist, call domain services,
  publish events, enqueue work, or own request-specific ordering.

## Transactions

- Keep transaction functions small and focused on atomic writes and the
  committed state returned to the caller.
- Perform preparation reads before the transaction with read repository options
  by default. Do not pass write or transaction options to ordinary reads.
- Keep a read inside the transaction only when a named invariant requires a
  transaction-scoped snapshot, lock, or claim. Document that requirement in the
  use case or its owning architecture decision.
- Use row locks only for such a named invariant.
- Do not put request validation, event publication, post-commit side effects,
  unrelated external calls, or large domain/history assembly blocks inside the
  persistence function.
- Prepare domain state, history payloads, events, and response data before or
  after the transaction when correctness does not require the transaction lock.
- When allocation locks or transaction-scoped reads are required for
  correctness, keep them inside the transaction boundary but separate them from
  the write-focused persistence function with named preparation and persistence
  phases.
- A reader should be able to identify atomic reads, writes, and returned
  committed state without reading the complete workflow inline.

Follow [Service Ownership](service-ownership.md) for transaction and extraction
decisions and [Readability](readability.md) for workflow presentation.
