# ADR 0015: Transactional outbox for ledger balance propagation

## Status

Superseded by direct balance queue delivery.

Posting use cases enqueue journal IDs after committing. The balance worker reads
the journal directly and applies the adjustments in a database transaction.
Enqueue failures are reported by the queue adapter after the journal commits.

## Context

Journal entries are the authoritative accounting record. Ledger account
balances are eventually consistent values used primarily for reads and UI
display.

Previously, journal creation queued one adjustment per directly affected
account. Each worker transaction updated one balance and then queued the next
control account recursively. A later queue or adjustment failure could leave
the balance propagation incomplete, and a failed initial Redis enqueue left no
database record from which delivery could be recovered.

## Decision

Store a generic `core.outbox` row in the same database transaction as every new
posted journal that requires balance propagation. The row contains only its ID,
originating correlation ID, type, nullable data, and creation time. The sole
current type is `balance_propagation`. For that type, the outbox ID is the
journal entry ID and `data` is null, so the journal identifier is not duplicated
inside JSON.

After commit, enqueue the journal entry ID as a best-effort delivery step. If
Redis delivery fails, the retained outbox row provides the durable source for
an explicit retry or later recovery mechanism. Queue delivery does not delete
or change the row.

Before opening a write transaction, the worker reads the matching outbox row,
reloads the posted journal, resolves the directly affected accounts and every
control-account ancestor from their materialized paths, reads the current
balances, and prepares the adjustments. A missing outbox row is reported and
balance updates are skipped.

The write transaction contains only the prepared balance writes and the outbox
deletion. It deletes the outbox row only after every balance write succeeds.

Balance updates use the existing optimistic version checks. The unique
`(ledger_account_id, journal_entry_id)` adjustment constraint also prevents the
same journal from being applied twice to an account. A concurrent losing
transaction rolls back without requiring pessimistic locks.

The outbox has no status, attempt count, completion time, propagation-specific
columns, or generic handler registry. Row presence alone represents outstanding
work.

## Consequences

### Positive

- Redis loss or a failed post-commit enqueue cannot erase the durable
  propagation intent; the outstanding row remains queryable for recovery.
- Direct and ancestor balances move atomically for a journal; recursive queue
  fan-out is removed.
- Workers reconstruct balance adjustments from the authoritative journal
  instead of trusting calculated queue payloads.
- Duplicate queue delivery is handled by optimistic balance versions, the
  unique account/journal adjustment constraint, and transactional outbox
  deletion.

### Negative

- Balance display remains eventually consistent by design.
- The application now owns a generic outbox persistence table and a typed
  service for creating its balance-propagation rows.
- A permanently unprocessable row remains in the outbox until an operator
  repairs or explicitly removes it. This affects only balance propagation;
  journal correctness is unchanged.
