# Journal Entry Entity Invariants

These invariants define the bookkeeping and data-reliability guarantees for
journal entries and their journal lines. They apply independently of the
accounting framework used for reporting. Framework-specific recognition,
valuation, and presentation requirements belong to the accounting domain.

## Table of Contents

- [Journal Entry](#journal-entry)
- [Journal Line](#journal-line)
- [References](#references)

## Journal Entry

A [Journal Entry](../entities/journal-entry.entity.ts) records a balanced set of
debits and credits for one Accounting Entity. Its effective date places the
activity in the books; its posting time identifies when the entry was accepted
as a financial record. Its lines identify the affected accounts, monetary
amounts, and any counterparties. Supporting attachments and a memo explain the
record without replacing its financial content.

Journal entries are the authoritative financial record. Ledger balances are
derived, eventually consistent views, as described in the
[ledger architecture](../../ledger/__doc__/02-architecture.md#journal-entries-adjustments-and-propagation).

| ID     | Invariant                                                                                                                                                                                                                            | Accounting basis / rationale                                                                                                                                           | References (optional)                                                      |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| JE-001 | A journal entry belongs to one Accounting Entity throughout its lifetime.                                                                                                                                                            | **Entity attribution:** moving an entry between entities would remove activity from one set of books and introduce it into another without an explanatory transaction. | —                                                                          |
| JE-002 | Every recorded entry, including a draft, must contain at least one debit line and one credit line, with total debits equal to total credits in the Accounting Entity's functional currency.                                          | **Double-entry bookkeeping:** an unbalanced entry records an incomplete financial effect and breaks the equality underlying the books.                                 | [Double-entry recording][journal-recording]                                |
| JE-003 | Every line's functional amount must be measured in the functional currency of the entry's Accounting Entity.                                                                                                                         | **Consistent monetary measurement:** equal numeric totals in different currencies do not establish a balanced entry.                                                   | —                                                                          |
| JE-004 | An entry's effective date must determine the accounting period to which its activity belongs, independently of when it is created or posted; acceptance of a posting must satisfy the shared accounting-period rules.                | **Period attribution:** using processing time instead of the effective date can place activity in the wrong period and change period results.                          | [ACC-AP-004–005](../../accounting/__doc__/invariants.md#accounting-period) |
| JE-005 | An entry that has never been posted must not contribute to ledger balances.                                                                                                                                                          | **Separation of proposed and accepted activity:** including drafts would present unaccepted transactions as financial facts.                                           | —                                                                          |
| JE-006 | Once posted, an entry's original financial content must remain recoverable and must not be overwritten or physically deleted; correcting that content requires a reversing entry and, when replacing it, a separate corrected entry. | **Historical integrity:** silent alteration or removal destroys the evidence needed to reconstruct and explain previously recorded activity.                           | [Financial-record preservation][append-only]                               |
| JE-007 | A reversal must negate the original entry's recorded debit and credit effects for the same accounts and counterparties, preserving transaction currencies, transaction amounts, and functional amounts while reversing the sides.    | **Exact cancellation:** changing attribution or remeasuring the original at a new exchange rate leaves a residual financial effect instead of cancelling it.           | [Financial-record preservation][append-only]                               |
| JE-008 | A voided entry must retain an identifiable link to the posted entry that reverses it within the same Accounting Entity.                                                                                                              | **Traceable cancellation:** a void designation without its corresponding reversal cannot explain how the original financial effect was cancelled.                      | —                                                                          |
| JE-009 | Archiving an entry must preserve its recorded content and posting history without adding or removing a financial effect.                                                                                                             | **Completeness:** treating archival as a financial cancellation would change balances without a balancing entry.                                                       | —                                                                          |
| JE-010 | Creation and subsequent changes to a retained entry, including its lines, must retain a history sufficient to establish what changed, when, and by whom.                                                                             | **Traceability:** an unexplained change prevents reconciliation of the current record with its earlier financial meaning.                                              | —                                                                          |
| JE-011 | An entry creation or change must take effect together with its complete line set and corresponding history; a correction must also include its reversal and any replacement as one indivisible change.                               | **Atomic financial recording:** a partial entry or correction can leave unsupported history, an incomplete cancellation, or a missing replacement.                     | —                                                                          |
| JE-012 | A change or removal based on an earlier entry state must not silently overwrite or remove a subsequently accepted change.                                                                                                            | **Prevention of lost changes:** concurrent maintenance must not discard accepted corrections or make the surviving entry inconsistent with its history.                | —                                                                          |
| JE-013 | Once a posting is accepted, its outstanding effect on derived ledger balances must remain recoverable until applied.                                                                                                                 | **Completeness:** a delivery or processing failure must not permanently omit an accepted journal from derived balances.                                                | [Balance propagation][balance-propagation]                                 |
| JE-014 | Applying the same posted entry to derived ledger balances more than once must not duplicate its financial effect.                                                                                                                    | **Prevention of double counting:** retries must not increase or decrease balances again for the same recorded activity.                                                | [Balance propagation][balance-propagation]                                 |

A voided original and its reversal remain financial records. Their effects
cancel when both are included; excluding only the original would leave the
reversal as an unsupported opposite effect. Each retains its own effective date,
so a reversal in a later period does not erase the original period's activity.

## Journal Line

A [Journal Line](../entities/journal-line.entity.ts) records one debit or credit
within a Journal Entry. It identifies a posting ledger account, an optional
counterparty, an amount in the transaction currency, and the corresponding
functional-currency amount. The exchange rate explains the relationship between
those amounts when their currencies differ.

The [Ledger Account invariants](../../ledger/__doc__/invariants.md#ledger-account)
govern account attribution, posting versus control accounts, account-currency
compatibility, and preservation of referenced accounts (LED-LA-001, LED-LA-005,
LED-LA-008–009). The
[Counterparty invariants](../../counterparty/__doc__/invariants.md#counterparty)
govern the ownership and continued identity of a referenced counterparty
(CP-001–003). These guarantees apply to the accounts and counterparties
referenced by journal lines.

| ID     | Invariant                                                                                                                                                                                                                                                                                       | Accounting basis / rationale                                                                                                                                    | References (optional)                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| JL-001 | A journal line belongs to exactly one entry throughout its lifetime and must not be duplicated within that entry's line set.                                                                                                                                                                    | **Record integrity:** moving or counting the same line twice changes the financial content of the affected entries without a distinct transaction.              | —                                                                        |
| JL-002 | A line must express one unambiguous debit or credit effect on its account, using a non-negative amount whose direction is determined by its side.                                                                                                                                               | **Debit/credit meaning:** conflicting amount and side directions can invert the intended effect and make balance calculations ambiguous.                        | —                                                                        |
| JL-003 | A line's functional amount must equal its transaction amount when both use the same currency; otherwise it must be derived from that amount using a positive exchange rate from the transaction currency to the entry's functional currency, with the currencies' monetary precision respected. | **Consistent valuation:** an unrelated functional amount, reversed currency pair, or incorrect scale misstates the recorded value and can conceal an imbalance. | [Currency conversion](../../money/__docs__/money.md#currency-conversion) |
| JL-004 | A posted line must retain its transaction amount, functional amount, and the conversion basis connecting them, independently of subsequent exchange-rate changes.                                                                                                                               | **Reproducible measurement:** recalculating historical lines from later rates silently changes the entry's financial effect and prevents reconciliation.        | [Financial-record preservation][append-only]                             |

Entry-level balance, correction, history, and atomicity guarantees apply to
changes involving journal lines as part of their owning entry. Monetary
calculation conventions are documented in
[Money](../../money/__docs__/money.md#working-with-money).

## References

- [OpenStax, _Principles of Accounting, Volume 1: Financial Accounting_, §3.5][journal-recording],
  “Formatting When Recording Journal Entries” (2019), supports the general
  double-entry balance rule. Applying that balance rule to retained drafts is
  the domain's record-consistency guarantee, not a separate reporting-standard
  requirement.
- [ADR 0003: Append-Only Database Pattern for Financial Records][append-only]
  establishes the preservation and reversal approach for recorded financial
  facts. Here, that preservation obligation applies once an entry is posted;
  unposted drafts can be revised or removed.
- [ADR 0015: Transactional outbox for ledger balance propagation][balance-propagation]
  establishes recoverable and non-duplicating propagation from authoritative
  journal entries to derived balances.

[journal-recording]: https://openstax.org/books/principles-financial-accounting/pages/3-5-use-journal-entries-to-record-transactions-and-post-to-t-accounts
[append-only]: ../../../../docs/adrs/0003-append-only-database-pattern.md
[balance-propagation]: ../../../../docs/adrs/0015-transactional-outbox-for-ledger-balance-propagation.md
