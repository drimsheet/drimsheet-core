# Ledger Account Entity Invariants

These invariants define the bookkeeping and data-reliability guarantees for
ledger accounts, including their control and posting roles. They apply
independently of the accounting framework used for reporting. Recognition,
valuation, and framework-specific presentation belong to the accounting domain.

## Ledger Account

A [Ledger Account](../entities/ledger-account.entity.ts) identifies a category of
financial activity in one Accounting Entity's Chart of Accounts. Its
classification and normal balance explain how debits and credits affect that
category. A posting account is referenced by journal lines; a control account
groups descendant accounts for aggregation. Root accounts have no parent and
can include posting accounts, such as suspense accounts.

An account may have a fixed currency or accept activity in multiple currencies.
Contra and adjunct accounts identify the account whose balance they offset or
supplement; that relationship is distinct from their place in the control-account
hierarchy. Journal entries remain the authoritative financial record, as
described in the [ledger architecture](./02-architecture.md#journal-entries-adjustments-and-propagation).

| ID         | Invariant                                                                                                                                                                                                                                                              | Accounting basis / rationale                                                                                                                                                   | References (optional)                                                                    |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| LED-LA-001 | A ledger account belongs to one Accounting Entity throughout its lifetime; journal lines referencing it must belong to that same Accounting Entity.                                                                                                                    | **Entity attribution:** cross-entity references mix separate books and assign financial activity to the wrong entity.                                                          | —                                                                                        |
| LED-LA-002 | An account code must identify only one ledger account within an Accounting Entity's Chart of Accounts, including retained archived accounts.                                                                                                                           | **Unambiguous identification:** duplicate codes make account selection and reconciliation ambiguous and can misdirect financial activity.                                      | —                                                                                        |
| LED-LA-003 | Changes to an account's details or status must preserve its identity and the classification, currency meaning, and aggregation attribution of previously recorded activity.                                                                                            | **Continuity of financial meaning:** account maintenance must not silently reclassify, redenominate, or redirect existing transactions.                                        | —                                                                                        |
| LED-LA-004 | Every non-root ledger account must have one control-account parent in the same Accounting Entity and primary account class, with an ancestry that reaches a root without cycles.                                                                                       | **Consistent aggregation:** broken or circular ancestry can omit or repeatedly count activity; an incompatible parent puts totals in the wrong entity or financial category.   | —                                                                                        |
| LED-LA-005 | Control accounts must derive their financial activity from descendant posting accounts and must not receive direct journal lines, including opening-balance lines.                                                                                                     | **Reconciliation:** direct activity at a summary level would leave the control total unsupported by its underlying posting accounts.                                           | [Aggregation model](./02-architecture.md#journal-entries-adjustments-and-propagation)    |
| LED-LA-006 | An account's normal balance must match its economic role: ordinary assets and expenses are debit-normal, and ordinary liabilities, equity, and revenue are credit-normal; a contra account is opposite to its target and an adjunct account is the same as its target. | **Debit/credit meaning:** an incorrect normal side reverses the interpretation of increases, decreases, and offsetting balances.                                               | [Normal balances][normal-balances]; [Adjustment relationships][adjustment-relationships] |
| LED-LA-007 | A contra or adjunct account must identify the existing account it adjusts within the same Accounting Entity, independently of its control-account parent.                                                                                                              | **Traceable adjustments:** the offset or supplement must be attributable to the intended balance; hierarchy alone cannot explain that relationship.                            | [Adjustment relationships][adjustment-relationships]                                     |
| LED-LA-008 | Every journal line referencing a fixed-currency ledger account must use that currency for its transaction amount. Accounts without a fixed currency may accept different transaction currencies, whose identities must remain distinguishable.                         | **Consistent monetary measurement:** treating different currencies as one unit misstates the account's activity and prevents reconciliation.                                   | —                                                                                        |
| LED-LA-009 | A ledger account must remain identifiable while financial records reference it, including draft journal lines; archiving must preserve those references and the account's historical contribution to totals.                                                           | **Record integrity and completeness:** removing an account or excluding its history because it is archived leaves transactions unexplained or understates historical totals.   | [Historical account retention](./02-architecture.md#account-archiving)                   |
| LED-LA-010 | Account creation and subsequent changes must retain a history sufficient to establish what changed, when, and by whom.                                                                                                                                                 | **Traceability:** changes affecting the interpretation of financial activity must remain distinguishable from the original account record.                                     | —                                                                                        |
| LED-LA-011 | An account creation or change and its corresponding history must take effect together or neither must take effect.                                                                                                                                                     | **Consistency and completeness:** an account without its change history is unexplained, while history for a change that did not take effect misstates the account's evolution. | —                                                                                        |
| LED-LA-012 | An account change based on an earlier state must not silently overwrite a subsequently accepted change.                                                                                                                                                                | **Prevention of lost changes:** concurrent maintenance must preserve accepted corrections and keep the surviving account consistent with its history.                          | —                                                                                        |

Normal balance describes the expected direction of an account, not a restriction
that its actual balance must always be on that side. A balance on the opposite
side does not by itself make the account a contra account.

## References

- [OpenStax, _Principles of Accounting, Volume 1: Financial Accounting_, §3.1][normal-balances],
  “Normal Balance of an Account” (2019). This supports general debit/credit
  conventions, not a framework-specific reporting requirement.
- [ADR 0012: Relational Contra & Adjunct Accounts][adjustment-relationships]
  defines the domain's distinction between aggregation and adjustment
  relationships.

[normal-balances]: https://openstax.org/books/principles-financial-accounting/pages/3-1-describe-principles-assumptions-and-concepts-of-accounting-and-their-relationship-to-financial-statements
[adjustment-relationships]: ../../../../docs/adrs/0012-relational-contra-adjunct-accounts.md
