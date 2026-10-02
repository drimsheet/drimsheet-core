# Service Philosophy

A service is a named capability with explicit ownership. It is not a bucket for
related functions, a convenience wrapper, or a way to shorten a use case.

Use this sentence before creating or keeping a service:

> This service exists because the system needs a named capability to **\_**,
> owned by **\_**, with these invariants, side effects, and failure semantics:
> **\_**.

If the sentence is awkward, the behavior probably belongs in an entity, value,
rule, policy, use case, repository, adapter, or IoC module instead.

## Layer Philosophy

### Domain

Domain services own business decisions, invariants, and coordinated domain
creation within a bounded context.

- Prefer dependency-free domain services.
- Use a repository only when persisted state is required to enforce a domain
  invariant.
- Query only the state needed for that invariant.
- Return a domain decision, entity creation result, events, audits, or a domain
  error.
- Do not own application transactions, history construction, event publication,
  queues, context mutation, logging, or persistence workflows.

Ask:

1. What domain decision is being made?
2. Who owns that decision?
3. Is persisted state required to answer it?

### Application

Application services own reusable application capabilities. They may coordinate
domain behavior, read-only repositories, and ports when the capability is
independently meaningful. They prepare results; they do not persist them.

- Define the contract around the capability, not the feature folder.
- Document whether the service rejects, best-efforts, queues, retries, claims
  exclusive work, or requires a caller-supplied transaction for invariant reads.
- Do not invoke write repositories or persistence services. Return the domain
  or application result to the use case that decides and orders persistence.
- Keep domain decisions visible in entities, values, domain rules, or domain
  services.
- Keep request-specific choreography in the use case, even when extraction
  would make the use case shorter.

Ask:

1. Is this a reusable application capability?
2. Does it have an independently meaningful contract?
3. What side effects and failure semantics does the caller rely on?

### Persistence Services

Persistence services are the narrow exception for composing writes. They are
application-layer capabilities, but they are invoked directly by use cases and
do not own workflow decisions.

- Compose repository writes only when the persisted bundle requires atomicity
  or storage-level invariants across repositories.
- Join the transaction supplied by the use case, or create only the local
  transaction required to make their own bundle atomic.
- Do not call domain services, decide whether to persist, publish events,
  enqueue work, or invoke another persistence service.
- Return persistence completion or a persistence error to the use case.

### Use Cases

Use cases own request-specific ordering and orchestration.

- Validate request DTOs and read request context.
- Coordinate domain/app capabilities for one workflow.
- Solely initiate persistence, whether through repositories or a dedicated
  persistence service.
- Own the outer workflow transaction, persistence ordering, history creation,
  app context updates, and event publication.

### Repositories

Repositories store and retrieve one entity family. They do not own business
decisions, workflow transactions, queueing, events, reporting, or cross-entity
coordination.

### Infrastructure And IoC

Infrastructure owns concrete adapters and runtime implementations. IoC modules
compose dependencies; they are not behavioral services, handlers, or use cases.

Do not use behavioral suffixes such as `.service.ts`, `.handler.ts`, or
`.usecase.ts` for IoC composition modules in new code. Existing IoC files may
keep their names until a migration is planned.

## Disposition Vocabulary

- **Keep:** the service has a named capability, correct owner, meaningful
  contract, tests, and clear failure semantics.
- **Narrow:** the service is valid, but contains decisions or side effects owned
  elsewhere.
- **Split:** the service name hides multiple capabilities with different owners
  or failure semantics.
- **Move:** the capability is real, but the file lives in the wrong layer.
- **Scrutinize:** the service has only one production caller. It may still be
  valid in a growing application, but it needs a strong capability name,
  explicit semantics, and a reason to exist outside the caller.
- **Inline:** the behavior belongs to one request-specific workflow and has no
  independent contract after scrutiny.
- **Delete:** the behavior is dead, redundant, or only re-exports another owner.
- **Rename:** the capability is real, but the name hides what it owns.

## Examples

- Domain service: create an accounting entity with its fiscal year, periods,
  contexts, events, and audits without persisting or publishing them.
- Repository-backed domain service: find the accounting period for a posting
  date and assert that it is open.
- Persistence service: atomically persist a journal entry header and its lines;
  the journal use case invokes it at the required workflow point.
- Application service: queue balance propagation as best-effort work and report
  failures exactly once.
- Not an application service: resolving an FX effect and then invoking its
  persistence service. Return the resolved effect so the use case persists it.
- Not a service: a helper that exists only to hide a few lines inside one use
  case.
- Not a domain service: a persistence workflow that saves domain entities,
  histories, and related records.
