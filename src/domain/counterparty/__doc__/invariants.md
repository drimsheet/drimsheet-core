# Counterparty Entity Invariants

These invariants define the bookkeeping and data-reliability guarantees for
counterparties. They apply independently of the accounting framework used for
reporting.

## Counterparty

A [Counterparty](../entities/counterparty.entity.ts) represents an individual or
organization with which an Accounting Entity has dealings. It identifies the
other party on journal lines and carries the details of that party's
relationships with the Accounting Entity. Multiple roles can belong to the same
counterparty without creating separate identities for those relationships.

| ID     | Invariant                                                                                                                                                                                                 | Accounting basis / rationale                                                                                                                                                       | References (optional) |
| ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| CP-001 | A counterparty belongs to one Accounting Entity throughout its lifetime; journal lines referencing it must belong to that same Accounting Entity.                                                         | **Entity attribution:** cross-entity references mix separate books and misattribute dealings to another entity's counterparty records.                                             | —                     |
| CP-002 | Changes to a counterparty's details, roles, or status must preserve its identity and the identity referenced by existing journal lines.                                                                   | **Continuity of attribution:** maintaining counterparty details must not detach transactions from their party or redirect them to a different party.                               | —                     |
| CP-003 | A counterparty must remain identifiable while any journal line references it, regardless of the journal's status. It must not be deleted while those references remain, and archiving must preserve them. | **Record integrity:** removing a referenced party breaks the explanation of whom a recorded transaction concerns, including transactions awaiting posting.                         | —                     |
| CP-004 | Counterparty creation and subsequent changes must retain a history sufficient to establish what changed, when, and by whom.                                                                               | **Traceability:** corrections to party details must remain distinguishable from the original record so that changes affecting the interpretation of transactions can be explained. | —                     |
| CP-005 | Deleting an unreferenced counterparty must preserve its existing change history and that history's attribution to the counterparty and Accounting Entity.                                                 | **Historical integrity:** removal of an unused record must not erase the evidence of its creation or earlier changes.                                                              | —                     |
| CP-006 | A counterparty creation or change and its corresponding history must take effect together or neither must take effect.                                                                                    | **Consistency and completeness:** a current record without its history is unexplained, while history for a change that did not take effect misstates the record's evolution.       | —                     |
| CP-007 | An update or deletion based on an earlier counterparty state must not silently overwrite or remove a subsequently accepted change.                                                                        | **Prevention of lost changes:** concurrent maintenance must not discard accepted corrections or make the surviving record inconsistent with its history.                           | —                     |
