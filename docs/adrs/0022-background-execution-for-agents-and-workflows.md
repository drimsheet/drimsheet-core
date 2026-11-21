# ADR 0022: Background Execution for Agents and Workflows

## Status

Accepted

## Context

Agents and workflows can make several model calls and pause for user input.
Their runtime can exceed the HTTP request budget. The API and BullMQ workers
run in separate processes, so live chat needs a way to receive worker progress.

## Decision

- Use cases in the AI module (`src/app/ai`) may call structured LLMs
  directly. Use cases in other application modules must delegate AI work
  through background queue contracts. Tools, agents, and workflows stay
  outside use-case dependencies.
- Background workers start or resume agents and workflows. A worker can also
  execute a standalone structured LLM call, which performs one model operation
  and returns schema-validated output.
- A tool wraps one use case or one structured LLM call. An agent uses the
  model to choose from its available tools. A workflow follows predefined
  steps and can call use cases, structured LLM calls, or an agent within the
  same worker execution. Use cases retain authorization and write ownership.

### Chat progress and user input

The start use case returns a run ID after enqueueing. Persist the run state in
MongoDB per [ADR 0021](0021-mongo-db-for-agent-workflow-storage.md). After a
use case saves the state, the worker publishes a Redis Pub/Sub signal with
the run ID. The API subscribes, reads the saved state, and sends the update
to the browser over server-sent events (SSE). The API reads the saved state
when the browser connects or reconnects and refreshes active runs if its
Redis subscription reconnects.

When a run needs user input, the worker calls a use case to save the pending
question or proposed action and the state needed to resume. The run becomes
`waiting_for_input`, and the job ends. A reply or approval goes through a use
case that validates it against the pending request, records it, and queues the
same run to resume.

## Consequences

- HTTP requests return promptly and workers can handle other jobs while a
  run waits for input.
- Redis Pub/Sub provides live notifications using the Redis instance already
  used by BullMQ. A missed signal can delay a live update until the API
  reloads the saved state. RabbitMQ Streams would add a broker and event
  retention for updates recoverable from saved state.
