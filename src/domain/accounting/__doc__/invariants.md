# Accounting Entity Invariants

These invariants define the accounting contract for each entity. Framework-specific
requirements apply only when the named framework governs the reporting.

## Table of Contents

- [Accounting Entity Invariants](#accounting-entity-invariants)
  - [Table of Contents](#table-of-contents)
  - [Accounting Entity](#accounting-entity)
  - [Fiscal Year](#fiscal-year)
  - [Accounting Period](#accounting-period)
  - [Reporting Period](#reporting-period)
  - [Accounting Context](#accounting-context)
  - [Reporting Context](#reporting-context)
  - [Shared Period Rules](#shared-period-rules)
  - [Accounting References](#accounting-references)

## Accounting Entity

An Accounting Entity identifies whose economic activities the books describe.
It carries the entity type, owner, jurisdiction, and functional currency, and
need not coincide with a separate legal person.

| ID         | Invariant                                                                                                                                                     | Accounting basis / rationale                                                                         | References                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------ |
| ACC-AE-001 | Records belonging to different accounting entities must retain their respective entity identities, even when they share an owner.                             | **Accounting principle:** keep each entity’s economic activities distinct.                           | [Conceptual Framework 3.10–3.14][cf] |
| ACC-AE-002 | An accounting entity must identify one functional currency using a recognized currency code.                                                                  | **Structural integrity:** monetary measurement needs an identified currency.                         | —                                    |
| ACC-AE-003 | Where IAS 21 applies, the selected functional currency must reflect the entity's primary economic environment.                                                | **IFRS requirement:** economic circumstances determine functional currency.                          | [IAS 21, functional currency][ias21] |
| ACC-AE-004 | The entity type and jurisdiction must be recognized by Drimsheet.                                                                                             | **Drimsheet policy:** classifications determine available accounting frameworks.                     | —                                    |
| ACC-AE-005 | An owner may have at most one Individual accounting entity.                                                                                                   | **Drimsheet policy:** one personal accounting entity per owner.                                      | —                                    |
| ACC-AE-006 | Functional amounts in an entity's ledger balances must use that entity's functional currency; changing the denomination must leave those balances consistent. | **Consistent measurement:** mixed functional denominations misstate aggregate balances.              | —                                    |
| ACC-AE-007 | An accounting entity referenced by journal entries must retain its identity and associated books when removed from active use.                                | **Record integrity:** removing the entity must not erase recorded activity or break its attribution. | —                                    |

## Fiscal Year

A Fiscal Year identifies the annual accounting cycle for one Accounting Entity.
Its dates bound that year's accounting and reporting periods.

| ID         | Invariant                                                                                                                       | Accounting basis / rationale                                                                            | References (optional) |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------- |
| ACC-FY-001 | A fiscal year must belong to one accounting entity.                                                                             | **Structural integrity:** attribute annual results to one entity.                                       | —                     |
| ACC-FY-002 | Fiscal-year dates must satisfy the [shared date rules](#shared-period-rules).                                                   | **Accounting principle:** measure activity over a defined period.                                       | —                     |
| ACC-FY-003 | On creation, the fiscal-year duration must not exceed the maximum configured for the entity's jurisdiction.                     | **Drimsheet policy:** jurisdiction-specific product limit, not a statement of law.                      | —                     |
| ACC-FY-004 | A fiscal-year status must be one of Pending, Open, Closing, or Closed.                                                          | **Drimsheet policy:** identify the stage of the accounting cycle.                                       | —                     |
| ACC-FY-005 | Fiscal years belonging to the same accounting entity must not overlap, regardless of status; start and end dates are inclusive. | **Data reliability:** each calendar date belongs to at most one annual accounting cycle for the entity. | —                     |

An annual cycle need not be exactly twelve months. [IAS 1, paragraphs 36–37][ias1]
allow changed reporting periods with required disclosures and 52-week reporting,
subject to applicable jurisdiction restrictions.

## Accounting Period

An Accounting Period is a posting interval within a Fiscal Year. Its status controls
whether postings are accepted.

| ID         | Invariant                                                                                                         | Accounting basis / rationale                                                  | References (optional) |
| ---------- | ----------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | --------------------- |
| ACC-AP-001 | An accounting period and its fiscal year must belong to the same accounting entity.                               | **Structural integrity:** preserve calendar ownership.                        | —                     |
| ACC-AP-002 | An accounting period's start and end must fall within its fiscal year's start and end.                            | **Accounting principle:** posting intervals subdivide the annual cycle.       | —                     |
| ACC-AP-003 | Accounting-period dates and generation parameters must satisfy the [shared period rules](#shared-period-rules).   | **Structural integrity:** use valid intervals and generation parameters.      | —                     |
| ACC-AP-004 | A posting must have exactly one covering accounting period belonging to the posting's accounting entity.          | **Accounting principle:** allocate activity to the correct entity and period. | —                     |
| ACC-AP-005 | The accounting period used for a posting must have status Open when that posting is accepted.                     | **Drimsheet policy:** control changes to period results.                      | —                     |
| ACC-AP-006 | Accounting periods belonging to the same accounting entity must not overlap, regardless of status or fiscal year. | **Data reliability:** each date has unambiguous period ownership.             | —                     |
| ACC-AP-007 | Generated accounting periods must cover every date of their fiscal year without gaps.                             | **Accounting principle:** the full annual cycle has a posting interval.       | —                     |

Accounting-period boundaries are inclusive calendar dates. If one period begins
on January 4, the previous period ends on January 3. January 3 belongs only to the
previous period, and January 4 belongs only to the next. Different accounting
entities may use the same dates. Non-overlap must hold before postings are
accepted. Missing, ambiguous or non-Open periods prevent posting.

## Reporting Period

A Reporting Period defines the interval presented by a report within a Fiscal Year.
Its cadence may differ from the posting cadence; it does not authorize postings.

| ID         | Invariant                                                                                                      | Accounting basis / rationale                                              | References (optional)  |
| ---------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | ---------------------- |
| ACC-RP-001 | A reporting period and its fiscal year must belong to the same accounting entity.                              | **Structural integrity:** preserve the reporting entity’s boundary.       | —                      |
| ACC-RP-002 | A reporting period's start and end must fall within its fiscal year's start and end.                           | **Drimsheet policy:** reporting intervals belong to a single fiscal year. | —                      |
| ACC-RP-003 | Reporting-period dates and generation parameters must satisfy the [shared period rules](#shared-period-rules). | **Structural integrity:** every report needs a defined interval.          | —                      |
| ACC-RP-004 | A period described as interim under IAS 34 must be shorter than a full financial year.                         | **IFRS requirement:** distinguish interim from annual reporting.          | [IAS 34, About][ias34] |

Reporting intervals may overlap, as with quarterly and year-to-date reports.

Generated reporting calendars use inclusive UTC calendar dates. Within one
generated cadence, the next interval starts on the day after the previous
interval ends: January–March includes March 31, and April–June starts April 1.
The first and last intervals include the fiscal year's first and last dates.
Different reporting cadences may cover the same dates without changing posting
eligibility.

## Accounting Context

An Accounting Context associates an Accounting Entity and Fiscal Year with an
accounting framework and a selected accounting period.

| ID         | Invariant                                                                                                                             | Accounting basis / rationale                                                                                          | References (optional) |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | --------------------- |
| ACC-AC-001 | The context's fiscal year must belong to its accounting entity.                                                                       | **Structural integrity:** attach the accounting basis to the correct annual cycle.                                    | —                     |
| ACC-AC-002 | The selected accounting period must belong to the context's fiscal year.                                                              | **Structural integrity:** select a period within the annual cycle; see [ACC-AP-001](#accounting-period).              | —                     |
| ACC-AC-003 | The accounting-standard code must identify a framework recognized by Drimsheet.                                                       | **Drimsheet policy:** make the accounting basis explicit.                                                             | —                     |
| ACC-AC-004 | On creation, the selected framework must be permitted by Drimsheet's configuration for the accounting entity's type and jurisdiction. | **Drimsheet policy:** restrict framework selection by entity type and jurisdiction.                                   | —                     |
| ACC-AC-005 | A fiscal year has at most one accounting context, including closed contexts.                                                          | **Record integrity:** preserve one authoritative accounting basis and working-period selection for each annual cycle. | —                     |

“Current” means the selected working period, which need not contain today's date.
Posting still requires the Accounting Period checks.

## Reporting Context

A Reporting Context links an Accounting Context to a reporting framework,
Reporting Period, and presentation currency. Presentation currency may differ
from the entity's functional currency.

| ID         | Invariant                                                                                                                                                                              | Accounting basis / rationale                                                                          | References (optional)                  |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------- |
| ACC-RC-001 | The reporting context and its accounting context must belong to the same accounting entity.                                                                                            | **Structural integrity:** preserve entity identity across reporting views.                            | —                                      |
| ACC-RC-002 | The selected reporting period must belong to the fiscal year identified by the linked accounting context.                                                                              | **Structural integrity:** align reporting with the annual cycle; see [ACC-RP-001](#reporting-period). | —                                      |
| ACC-RC-003 | The reporting framework must have a code recognized by Drimsheet.                                                                                                                      | **Drimsheet policy:** make the reporting basis explicit.                                              | —                                      |
| ACC-RC-004 | A reporting context must identify one reporting currency using a recognized currency code.                                                                                             | **Structural integrity:** identify the currency of presented amounts.                                 | —                                      |
| ACC-RC-005 | Where IAS 21 applies and presentation currency differs from functional currency, financial statements must be translated under the applicable IAS 21 requirements before presentation. | **IFRS requirement:** translate amounts when changing presentation currency.                          | [IAS 21, presentation currency][ias21] |

## Shared Period Rules

These rules cover Fiscal Year dates and Accounting Period and Reporting Period
intervals. `period.entity.ts` supplies shared behavior and an additional
Reporting Period constructor; both reporting-period constructors follow the same
contract.

| ID        | Invariant                                                                           | Accounting basis / rationale                                              | References (optional) |
| --------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------- |
| ACC-P-001 | Every start and end must identify a valid date.                                     | **Structural integrity:** boundaries must be meaningful dates.            | —                     |
| ACC-P-002 | An interval's start must not be after its end.                                      | **Structural integrity:** periods cannot run backwards.                   | —                     |
| ACC-P-003 | When generating a set of periods, count must be a positive integer.                 | **Drimsheet policy:** count represents the number of generated intervals. | —                     |
| ACC-P-004 | When generating periods, the unit must be Day, Week, Month, Quarter, or Year.       | **Drimsheet policy:** restrict generation to supported calendar units.    | —                     |
| ACC-P-005 | A generated set must begin at the fiscal-year start and end at the fiscal-year end. | **Structural integrity:** cover the full annual cycle.                    | —                     |

Date ordering does not determine which period owns a shared boundary date.
Period generation and posting-date lookup must use the same boundary convention.

## Accounting References

- **Conceptual Framework:** 2018 framework, as reproduced in the 2023 issued
  edition, paragraphs 3.10–3.14. Defines reporting entities; does not override
  IFRS Accounting Standards.
- **IAS 21:** IFRS Foundation summary on functional and presentation currencies.
  Apply the edition and amendments effective for the reporting period.
- **IAS 1:** 2022 issued edition, paragraphs 36–37. Applies to the cited annual
  reporting discussion until the entity adopts [IFRS 18][ifrs18], effective for
  annual periods beginning on or after 1 January 2027; early adoption is permitted.
- **IAS 34:** IFRS Foundation summary. Applies to interim reports asserting IFRS
  compliance where the entity uses IFRS for its annual statements.

[cf]: https://www.ifrs.org/content/dam/ifrs/publications/pdf-standards/english/2023/issued/part-a/conceptual-framework-for-financial-reporting.pdf?bypass=on
[ias21]: https://www.ifrs.org/issued-standards/list-of-standards/ias-21-the-effects-of-changes-in-foreign-exchange-rates/
[ias1]: https://www.ifrs.org/content/dam/ifrs/publications/pdf-standards/english/2022/issued/part-a/ias-1-presentation-of-financial-statements.pdf?bypass=on
[ias34]: https://www.ifrs.org/issued-standards/list-of-standards/ias-34-interim-financial-reporting/
[ifrs18]: https://www.ifrs.org/issued-standards/list-of-standards/ifrs-18-presentation-and-disclosure-in-financial-statements/
