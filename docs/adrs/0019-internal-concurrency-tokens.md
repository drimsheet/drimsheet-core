# ADR 0019: Internal Concurrency Tokens

## Status

Accepted

## Context

This supersedes ADR 0013. No current command requires stale-view detection;
persistence details should not shape delivery contracts.

## Decision

- Delivery DTOs neither accept nor expose persistence versions.
- Use cases derive `expectedVersion` from repository reads.
- Row locks require a named, transaction-scoped invariant.
- A client concurrency token requires a superseding ADR.

## Consequences

### Positive

- Interfaces stay persistence-agnostic; repositories retain compare-and-swap.

### Negative

- Commands do not detect a view that became stale before submission.
