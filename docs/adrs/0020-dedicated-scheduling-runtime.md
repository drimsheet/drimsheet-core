# ADR 0020: Dedicated background runtime

## Status

Accepted

## Context

Periodic tasks need a scheduling mechanism and a process owner. HTTP replicas
scale independently, so running schedules in each replica would duplicate work.

## Decision

Use node-cron for schedules and retain BullMQ for queued work. This separates
time-based execution from queued delivery and avoids queue infrastructure for
periodic tasks that do not require it.

Run schedules in a dedicated background process. This gives scheduled work its
own lifecycle and allows HTTP replicas to scale without adding schedulers.

Run one designated scheduler instance without distributed locking. The current
workload does not require multiple active schedulers, so a single instance avoids
unnecessary coordination.

## Consequences

- Deployment must supervise the background process and enforce one active
  scheduler instance.
- Scheduling pauses while that process is unavailable; each job must define its
  recovery behavior for missed execution.
- Multiple active scheduler instances would require revisiting coordination and
  duplicate-execution guarantees.

Implementation details are maintained in the
[runtime documentation](../../src/infra/runtime/__docs__/README.md#background-process)
and [operations guide](../observability-operations.md#cbn-exchange-rate-worker).
