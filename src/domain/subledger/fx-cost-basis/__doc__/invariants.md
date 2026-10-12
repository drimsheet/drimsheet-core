# FX Cost Basis Entity Invariants

These invariants cover the lots, acquisitions, dispositions, and disposition
allocations that explain foreign-currency cash holdings and their historical
cost basis. The bookkeeping and data-reliability guarantees apply independently
of the reporting framework. See the [domain glossary](fx-cost-basis.md) for
terminology and [reporting boundary](#reporting-boundary) for IFRS applicability.

## Shared FX Record Rules

These rules apply to all four entities. Allocations derive their Accounting
Entity and ledger account from their linked disposition and lot. Monetary
representation and conversion conventions are documented in
[Money](../../../money/__docs__/money.md).

| ID       | Invariant                                                                                                                                                                                                                              | Accounting basis / rationale                                                                                                                                                         | References (optional) |
| -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| FX-S-001 | Every linked lot, acquisition, disposition, allocation, and source journal movement must concern the same Accounting Entity and ledger account.                                                                                        | **Entity attribution:** consuming another account's or entity's holdings misstates both balances and the ownership of FX results.                                                    | —                     |
| FX-S-002 | Quantities must be measured in the holding account's foreign currency; basis, proceeds, and gain or loss must be measured in the owning Accounting Entity's functional currency for the recorded transaction.                          | **Consistent measurement:** amounts in different monetary units cannot be reconciled or subtracted as though they were comparable.                                                   | —                     |
| FX-S-003 | Acquisition, disposition, and any captured official rates must identify the conversion from the holding's foreign currency to the transaction's functional currency.                                                                   | **Measurement integrity:** an inverted or unrelated currency pair changes the meaning of the recorded basis and proceeds.                                                            | —                     |
| FX-S-004 | Recorded acquisitions, dispositions, allocations, and original lot acquisition facts must remain identifiable and unchanged by subsequent consumption or reversal; corrections must retain their relationship to the original records. | **Historical integrity:** rewriting the evidence makes prior holdings and realized results impossible to reconstruct.                                                                | —                     |
| FX-S-005 | Lot balance changes and their supporting records must retain sufficient history to establish the source transaction, the change, when it occurred, and who caused it.                                                                  | **Traceability:** an unexplained balance change cannot be reconciled to the financial activity that produced it.                                                                     | —                     |
| FX-S-006 | An acquisition, disposition, or reversal must take effect together with all corresponding lot balance changes, supporting FX records, and change history, or none of those effects may take effect.                                    | **Completeness and consistency:** partial recording can leave holdings without acquisition evidence or report a disposal without removing its basis.                                 | —                     |
| FX-S-007 | Reprocessing the same source account movement or its reversal must not apply its FX quantity, basis, or realized result more than once.                                                                                                | **Prevention of duplicate effects:** repeated processing must not create holdings, consume them twice, or duplicate a gain or loss.                                                  | —                     |
| FX-S-008 | A lot change based on an earlier balance must not overwrite a subsequently accepted change or consume quantity or basis already consumed by it.                                                                                        | **Prevention of lost effects:** concurrent movements must not reuse the same holdings or erase an accepted consumption or restoration.                                               | —                     |
| FX-S-009 | Capturing an official rate must not silently replace the transaction rate or recognized amounts of an acquisition or disposition.                                                                                                      | **Preservation of measurement basis:** a separate statutory or tax rate must not rewrite historical holdings or disposal results and break their reconciliation to source movements. | —                     |

## FX Cost Basis Lot

An [FX Cost Basis Lot](../entities/lot.entity.ts) identifies a layer of foreign
currency acquired for one ledger account. It preserves the original quantity,
functional-currency basis, acquisition rate, and acquisition date while tracking
the quantity and basis still available. Acquisitions explain its origin;
disposition allocations explain its consumption. It follows the
[shared FX record rules](#shared-fx-record-rules).

| ID       | Invariant                                                                                                                                                                          | Accounting basis / rationale                                                                                                                          | References (optional) |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| FX-L-001 | A newly acquired lot's remaining quantity and remaining cost basis must equal the quantity and basis of its acquisition.                                                           | **Opening balance integrity:** a lot must begin with exactly the holdings and value recognized by its source acquisition.                             | —                     |
| FX-L-002 | A lot's remaining quantity must equal its original quantity less disposition quantities and reversed acquisition quantities, plus restored disposition quantities.                 | **Conservation of holdings:** every increase or decrease in available foreign currency must be explained by recorded activity.                        | —                     |
| FX-L-003 | A lot's remaining cost basis must equal its original basis less basis consumed by dispositions and removed by acquisition reversals, plus basis restored by disposition reversals. | **Conservation of basis:** historical cost must remain attributable either to the retained holding or to the recorded movements that removed it.      | —                     |
| FX-L-004 | Remaining quantity and remaining basis must each stay between zero and their respective original amounts, including after reversals.                                               | **No unsupported holdings:** consuming unavailable amounts creates negative holdings; excessive restoration invents quantity or basis never acquired. | —                     |
| FX-L-005 | A lot must be available for consumption exactly while it has remaining quantity; when its quantity reaches zero, its remaining basis must also be zero.                            | **Exhaustion integrity:** an exhausted holding must not retain stranded cost basis or remain available for a second disposal.                         | —                     |

The balance equations include accepted reversals. Reversing an acquisition
removes its effect from the remaining balances while preserving the original
acquisition facts and the evidence of the reversal.

A positive foreign-currency holding may have zero functional-currency basis
under the [money conversion conventions](../../../money/__docs__/money.md).
For example, a remaining USD 0.01 with JPY 0 basis is still available for
consumption under FX-L-005. Its final disposal consumes that exact zero basis
and closes the lot; zero measured basis does not erase the holding.

## FX Lot Acquisition

An [FX Lot Acquisition](../entities/acquisition.entity.ts) records an increase
in foreign-currency holdings and connects the resulting lot to its posted
journal entry. It preserves the quantity, recognized functional-currency basis,
transaction rate, and effective acquisition date, with a separately captured
official rate where available. It follows the
[shared FX record rules](#shared-fx-record-rules).

| ID       | Invariant                                                                                                                                                     | Accounting basis / rationale                                                                                                                              | References (optional) |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| FX-A-001 | An acquisition must represent an increase in the holding account recorded by its source posted journal movement.                                              | **Existence of holdings:** an unposted or unrelated movement must not create currency available for later consumption.                                    | —                     |
| FX-A-002 | The acquisition's quantity, basis, transaction rate, and effective date must agree with its source journal movement and the lot's original acquisition facts. | **Subledger reconciliation:** inconsistent acquisition facts give the same receipt different quantities, values, or timing in the ledger and lot records. | —                     |

## FX Lot Disposition

An [FX Lot Disposition](../entities/disposition.entity.ts) records a decrease
in foreign-currency holdings from a posted journal movement. It holds the total
quantity disposed, functional-currency proceeds, historical basis consumed, and
result on that basis. Its allocations identify the lots supplying those totals.
It follows the [shared FX record rules](#shared-fx-record-rules).

| ID       | Invariant                                                                                                                                                              | Accounting basis / rationale                                                                                                                    | References (optional) |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| FX-D-001 | A disposition's quantity, proceeds, transaction rate, and effective date must agree with the decrease recorded by its source posted journal movement.                  | **Subledger reconciliation:** the disposal must explain the same account movement and functional-currency value as the ledger.                  | —                     |
| FX-D-002 | A disposition's quantity, basis consumed, proceeds, and realized gain or loss must each equal the sum of the corresponding amounts in its allocations.                 | **Completeness of allocation:** unallocated amounts or excess allocations misstate the holdings consumed or the result attributed to them.      | —                     |
| FX-D-003 | A disposition's realized gain or loss must equal its proceeds less its consumed historical cost basis.                                                                 | **Measurement of the lot result:** any other amount breaks the explanation of the result by value received or recognized and basis surrendered. | —                     |
| FX-D-004 | A disposition reversal must restore each affected lot's original allocated quantity and consumed basis, without recomputing those amounts using a later exchange rate. | **Faithful reversal:** a reversal must undo the recorded consumption rather than introduce a new valuation difference.                          | —                     |

Here, proceeds include the functional-currency value recognized for a payment or
settlement; a disposition does not have to be a sale for cash. The realized
result is a historical lot-basis result, subject to the
[reporting boundary](#reporting-boundary).

## FX Lot Disposition Allocation

An [FX Lot Disposition Allocation](../entities/disposition-allocation.entity.ts)
connects one disposition to one consumed lot. It records that lot's contribution
to disposed quantity, consumed basis, proceeds, and realized result. A
disposition can have several allocations. Each allocation follows the
[shared FX record rules](#shared-fx-record-rules) and contributes to the totals
required by [FX-D-002](#fx-lot-disposition).

| ID        | Invariant                                                                                                                      | Accounting basis / rationale                                                                                                          | References (optional) |
| --------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| FX-DA-001 | An allocation's quantity and consumed basis must equal the reductions attributed to that disposition in its linked lot.        | **Agreement of detail and balances:** an allocation cannot explain a different consumption from the one applied to the holding.       | —                     |
| FX-DA-002 | An allocation that exhausts a lot must consume that lot's exact remaining basis, including any residual from earlier rounding. | **Conservation under rounding:** independently recalculating the final basis can strand value on a holding whose quantity is zero.    | —                     |
| FX-DA-003 | An allocation's realized gain or loss must equal its allocated proceeds less its consumed cost basis.                          | **Attribution of results:** each lot's contribution must explain its own gain or loss so the disposition result can be reconstructed. | —                     |

Rounding must preserve [FX-D-002](#fx-lot-disposition): for example, if proceeds
total 100 functional-currency minor units and earlier allocations receive 33
each, the final allocation receives 34. This preserves the recorded total.
An allocation may likewise have zero proceeds or consumed basis while carrying
positive foreign quantity. Such allocations still contribute to all disposition
totals, and their realized result remains proceeds less consumed basis.

## Reporting Boundary

FIFO is the current lot-selection method described in the
[domain glossary](fx-cost-basis.md). These invariants preserve the financial
meaning of the resulting records; FIFO is not asserted to be a universal FX
accounting or tax requirement.

Where IAS 21 applies, foreign-currency cash is a monetary item and is translated
at the closing rate at each reporting date. Historical remaining lot basis is
therefore not necessarily its financial-statement carrying amount. Exchange
differences spanning reporting periods are attributed to the relevant periods;
a disposal result measured from original lot basis must not cause previously
recognized exchange differences to be counted again. See IAS 21 paragraphs 8,
23(a), and 28–29, reproduced in [AASB 121][aasb121].

## Accounting References

- **IAS 21 / AASB 121:** the linked AASB compilation incorporates IAS 21 and
  applies to annual periods beginning on or after 1 January 2025 and before
  1 January 2027. The cited paragraphs support the reporting boundary, not a
  FIFO or tax-basis requirement. Apply the framework and amendments effective
  for the reporting period concerned; Australian-specific provisions do not
  establish requirements for other jurisdictions.

[aasb121]: https://standards.aasb.gov.au/aasb-121-oct-2023
