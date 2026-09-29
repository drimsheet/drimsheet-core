# Ledger allocation database tests

Use a disposable PostgreSQL database whose name ends in `_test`, migrated with
the repository's migrations (including seeded NGN currency and NG jurisdiction).
Set the existing `POSTGRES_URL` to that database before invoking these commands:

```sh
npm run db:migrate up
npm test -- --config jest.db.config.js --runInBand
```

The suite checks Read Committed isolation and uses independent transactions and
PostgreSQL's blocking-PID graph to verify waiting, commit and rollback. It creates
uniquely identified fixtures and removes only those fixtures. It does not create
or reset the database, and it is excluded from the ordinary mocked Jest suite.

The account-ID reference in journal/FX preparation remains unchanged. This suite
covers the participating petty-cash allocation path; unchanged bank creation
does not yet follow its locking protocol.
