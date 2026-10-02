# Service Ownership

Follow [Service Philosophy](service-philosophy.md) for the doctrine, layer
questions, and disposition vocabulary.

Extract a service only when it represents a named capability with a clear
owner. Do not create a service merely to shorten a use case.

## Domain Services

- Own business invariants, domain decisions, and coordinated creation within
  one bounded context.
- Remain dependency-free by default.
- Depend on a repository only when persisted state is required to enforce an
  invariant. Use that repository for the invariant check, not to turn the
  domain service into a persistence workflow.
- Do not own application transactions, context updates, event publication, or
  cross-domain workflow orchestration.

## Application Services

- Own reusable application capabilities that coordinate domain behavior or
  ports, such as bootstrapping all ledger account families.
- Have an independently meaningful contract and focused tests.
- Define failure semantics in the service contract: whether the capability
  rejects or is best-effort.
- Return prepared results to the use case. They must not invoke write
  repositories or persistence services, and they must not decide to persist.
- May perform reads required by the capability, including transaction-scoped
  invariant reads supplied by the calling use case.
- For best-effort capabilities, the implementation catches and reports failures
  exactly once. Callers await the capability without repeating catches or
  reporter calls.
- Do not duplicate a single use case or hide its workflow behind a generic
  `onboarding`, `manager`, or `persistence` name.

## Persistence Services

- Are dedicated application-layer write capabilities with explicit
  `PersistenceService` contracts.
- Are invoked directly by use cases only. Domain services and other application
  services must never call them.
- Compose repository writes and storage-level invariants only when one persisted
  bundle must be atomic.
- Persist prepared domain/application records as supplied; do not revalidate
  entities, histories, events, or application-owned outbox decisions.
- May join a caller-owned transaction or create the transaction required for
  their own bundle, but they do not own the outer workflow or the decision to
  persist.

## Factories And Implementations

- Service factories construct capabilities and bind dependencies.
- Implement each service contract method in a file-private
  `make<Capability>(deps)` function typed as `IService['method']`. The exported
  service factory only composes those methods into a typed service object and
  returns the frozen object. Do not define capability bodies inline in the
  service object or inside the exported factory.
- Document every `make<Capability>` function with its purpose and any important
  behavior, side effects, consistency guarantees, or failure semantics.
- Service implementation functions own runtime behavior, including error
  handling, reporting policy, retries, and best-effort semantics.
- Do not move catches or reporting into a factory to make a call site shorter.
- When changing reusable failure semantics, inspect every caller and remove
  redundant reporting, impossible rejection tests, and stale reporter
  dependencies.

## Use Cases

- Own the request-specific workflow and ordering.
- Are the only layer allowed to initiate repository writes or invoke persistence
  services.
- Coordinate repository writes, outer transaction boundaries, history creation,
  application context updates, and event publication.
- Use a dedicated persistence service when multiple repository writes or
  storage-level invariants form one reusable atomic persistence bundle.

## Decision Check

1. Business invariant or coordinated domain creation? Domain service.
2. Reusable non-persistence application capability? Application service.
3. Atomic repository-write bundle? Persistence service, invoked by a use case.
4. Any decision or instruction to persist? Use case.
5. Storage or retrieval only? Repository.
6. Extraction only makes a function shorter? Keep it with the current owner.
