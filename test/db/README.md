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

The suite prepares bank and petty-cash accounts through the cash domain service
and persists real bank records in the allocation transaction. It covers bank/bank,
bank/petty-cash (in both orders), different immediate parents, unrelated accounting
entities, and rollback after a bank-record uniqueness failure. Account, balance,
audit snapshots, and bank linkage are checked after commit; failed writes must
leave no records or reserved code. Journal/FX preparation remains unchanged.

Header setup coverage also verifies all twenty-four header/equity/control accounts,
initial balances, and creation/assignment histories commit together. A failure
after the final statutory payable insert must roll back the entire setup and
publish no events. These cases use the same disposable database safeguards.
