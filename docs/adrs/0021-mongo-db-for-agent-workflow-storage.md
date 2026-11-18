# ADR 0021: MongoDB for Agent Workflow Storage

## Status

Accepted

## Context

Agent chat sessions, checkpoints, and workflow results have variable document
shapes and a different purpose from accounting records. Keeping this storage
separate makes PostgreSQL's accounting persistence and migration history easier
to understand and maintain. PostgreSQL JSONB and separate schemas could store
these payloads, but would retain a shared database and, with the current setup,
a shared migration history.

MongoDB is already available in `drimsheet-platforms` for local development and
tests, with a separate application user. No agent storage workflow contracts
have been defined yet.

## Decision

- Use MongoDB for agent workflow storage. PostgreSQL remains authoritative for
  accounting records and their audit history; agent actions persist accounting
  changes through existing application use cases.
- Use the native `mongodb` driver without Mongoose. We need document storage
  and connectivity, without an additional model framework.
- Configure one lazy, shared `MongoClient` per process through `MONGODB_URL`.
  The driver connects when an operation needs it. HTTP and background shutdown
  close the client if it was created; unused MongoDB does not gate startup.
- Follow the [agent storage convention](../05_building_block_view.md#agent-storage-contracts)
  for application-owned contracts and infrastructure implementations.
- This change establishes configuration and the convention only. It creates
  no collections, workflow contracts, repository implementations, or migration
  framework.

## Consequences

### Positive

- Accounting and agent persistence have distinct ownership and storage.
- New optional document fields and variable workflow payloads do not require
  relational schema migrations.
- The native driver supplies connection pooling without an additional ODM.

### Negative

- MongoDB adds a database to configure, operate, and back up.
- Changes that must transform existing documents still require explicit data
  updates; flexible schemas do not remove that responsibility.
- PostgreSQL and MongoDB writes do not share a database transaction.
