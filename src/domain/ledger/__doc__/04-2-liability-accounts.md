# Liability Accounts

## Table of Contents

- [Introduction](#introduction)
- [Current Liabilities](#current-liabilities)
  - [Short Term Debts](#short-term-debts)
  - [Payables](#payables)
  - [Accrued Expenses](#accrued-expenses)
  - [Deferred Revenues](#deferred-revenues)
- [Non-Current Liabilities](#non-current-liabilities)
  - [Long Term Loans](#long-term-loans)
  - [Lease Liabilities & Provisions](#lease-liabilities--provisions)
- [Suspense Accounts:](#suspense-accounts)
- [Application Bootstrap](#application-bootstrap)
  - [Individual](#individual)

## Introduction

Liability ledgers are used to track what an individual, sole trader or company owes. Per our [accounting philosophy](../../accounting/__doc__/accounting.md#philosophy), our liability ledgers are structured with reporting in mind.

Liability ledgers come in two reporting hierarchies:

- Current Liabilities
- Non-Current Liabilities

When a liability ledger/sub-ledger is created, it MUST be associated with one of the two reporting hierarchies.

By default, liability accounts carry a **credit** normal balance. This is automatically derived from the account type during creation.

To ensure our system is extensible, we have not baked functionalities into ledger codes or predefined accounts. For non-power users, our ledger accounts bootstrap will handle the creation of accounts and association of behaviors. For power users, they can create accounts and associate behaviors available to the account class.

### Implementation Status

| Account Group     | Code Block | Implementation File                                                                      | Status         |
| ----------------- | ---------- | ---------------------------------------------------------------------------------------- | -------------- |
| Short Term Debts  | `200xxx`   | [`short-term-loan.service.ts`](../services/liability-account/short-term-loan.service.ts) | ✅ Implemented |
| Payables          | `201xxx`   | [`payables.service.ts`](../services/liability-account/payables.service.ts)               | ✅ Implemented |
| Accrued Expenses  | `202xxx`   | —                                                                                        | 🔲 Types only  |
| Deferred Revenues | `203xxx`   | —                                                                                        | 🔲 Types only  |
| Long Term Loans   | `204xxx`   | —                                                                                        | 🔲 Types only  |
| Lease Liabilities | `205xxx`   | —                                                                                        | 🔲 Types only  |
| Provisions        | `206xxx`   | —                                                                                        | 🔲 Types only  |
| Suspense          | `299xxx`   | [`suspense-account.service.ts`](../services/suspense-account.service.ts)                 | ✅ Implemented |

The following table shows the behaviors of different liability account classes

<figure>
<img src="./assets/2-coa-liabilities.svg" alt="Liabilities Chart of Accounts" style="max-width: 100%; width: auto; max-height: 600px;">
<figcaption>

_Figure: View the mermaid sourcecode here: _[_2-coa-liabilities.mermaid_](./assets/2-coa-liabilities.mermaid)

</figcaption>
</figure>

## Current Liabilities

### Short Term Debts

- **Ledger codes**: 200xxx
- **Description**: accounts that are used to track short-term borrowings, such as overdrafts, credit card balances, or short-term personal loans.
- **Main reporting hierarchy**: Current Liabilities / Short Term Debts

#### Behaviors

| Sub-Class        | Reporting Hierarchy | Behaviors                                                                                                                                                                                                                 |
| ---------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Credit Cards     | /                   | <ul><li>Requires purchase/charge transaction for creation</li><li>Requires payment transaction for settlement</li><li>Supports manual reconciliations</li><li>Supports adjunct accounts (for interest and fees)</li></ul> |
| Overdrafts       | /                   | <ul><li>Automatically created if a linked bank account goes negative</li><li>Requires deposit transaction for settlement</li></ul>                                                                                        |
| Short Term Loans | /                   | <ul><li>Requires funding transaction for creation</li><li>Requires repayment transaction for settlement</li><li>Supports automated interest accrual</li></ul>                                                             |

#### Service Details

The short-term-loan account service ([`short-term-loan.service.ts`](../services/liability-account/short-term-loan.service.ts)) exposes:

- `createHeader()` — enforces header uniqueness and creates the `200000` control account
- `createSubAccount()` — validates the selected control account and creates a short-term-loan account
- `createCreditCardSubAccount()` — validates the selected control account and `ICreditCardAccountMeta` (`cardIssuer`, `lastFourDigits`)

All short-term debt sub-types have `contraAccountRule: 'contra_permitted'` and `adjunctAccountRule: 'adjunct_permitted'`.

### Payables

- **Ledger codes**: 201xxx
- **Description**: accounts that are used to track amounts owed to counterparties and statutory authorities.
- **Main reporting hierarchy**: Current Liabilities / Payables

#### Behaviors

| Sub-Class          | Reporting Hierarchy | Behaviors                                                                                                                                                                                                                                                                                                         |
| ------------------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Trade Payables     | /                   | <ul><li>Requires invoice or credit note transaction for creation</li><li>Requires payment or debit note transaction for settlement</li><li>Supports automated aging</li><li>Supports contra accounts (for early payment discounts)</li><li>Supports adjunct accounts (for interest on overdue accounts)</li></ul> |
| Statutory Payables | /                   | <ul><li>Requires tax computation or manual entry for creation</li><li>Requires statutory payment transaction for settlement</li><li>Does not support contra accounts</li><li>Does not support adjunct accounts</li></ul>                                                                                          |

#### Service Details

The payables account service ([`payables.service.ts`](../services/liability-account/payables.service.ts)) exposes:

- `createHeader()` — creates the `201000` payables control account
- `createStatutoryPayableSubAccount()` — validates `IStatutoryPayableAccountMeta` (taxAuthority, taxType); forces `ContraNotPermitted` and `AdjunctNotPermitted`
- `createTradePayableSubAccount()` — validates `ITradePayableAccountMeta` (counterpartyId, invoiceId); permits contra and adjunct

> [!NOTE]
> The ledger accepts any generic string for `taxType` in `IStatutoryPayableAccountMeta`. Specific tax policies and validation (e.g., Nigerian Tax Act types) are handled by the Accounting domain.

### Accrued Expenses

- **Ledger codes**: 202xxx

> [!NOTE]
> Out of scope for MVP (individual domain).\
> These classes will be scoped when we move to support sole traders.

### Deferred Revenues

- **Ledger codes**: 203xxx

> [!NOTE]
> Out of scope for MVP (individual domain).\
> These classes will be scoped when we move to support sole traders. Deferred revenues are primarily business functions.

## Non-Current Liabilities

### Long Term Loans

- **Ledger codes**: 204xxx
- **Description**: accounts used to track borrowings the entity intends to pay back over a period longer than 12 months (e.g., mortgages, student loans, auto loans).
- **Main reporting hierarchy**: Non-Current Liabilities / Long Term Loans

> [!NOTE]
> Entity implementation pending. Types defined in [`liability-account.types.ts`](../types/liability-account.types.ts) with behaviors: `Mortgage`, `OtherLongTermLoan`.

#### Behaviors

| Sub-Class             | Reporting Hierarchy | Behaviors                                                                                                                                                                                                  |
| --------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mortgages             | /                   | <ul><li>Requires origination transaction for creation</li><li>Requires scheduled payments for settlement (handling principal and interest breakdown)</li><li>Supports automated interest accrual</li></ul> |
| Other Long Term Loans | /                   | <ul><li>Requires funding transaction for creation</li><li>Requires scheduled repayment rules</li><li>Supports adjunct accounts (for accrued interest if not managed separately)</li></ul>                  |

### Lease Liabilities & Provisions

- **Ledger codes**: 205xxx, 206xxx

> [!NOTE]
> Out of scope for MVP.\
> These advanced liability classes are purposefully excluded from the initial release to maintain system simplicity for non-power users. The ledger code blocks are permanently reserved for future enterprise compliance features.

## Suspense Accounts:

- **Ledger codes**: 299xxx
- **Description**: See [Suspense Accounts](./04-9-suspense-accounts.md) for more information.

#### Service Details

The suspense account service ([`suspense-account.service.ts`](../services/suspense-account.service.ts)) exposes `createLiabilitySuspense` and creates accounts with:

- `subType: 'suspense'` / `behavior: 'default'`
- `isControlAccount: false` / `controlAccountId: null`
- Contra and adjunct accounts: **not permitted**
- `meta: null`
- Distinguished from asset suspense by the ledger code prefix (`299xxx` vs `199xxx`)

#### Behaviors

| Sub-Class | Reporting Hierarchy            | Behaviors                                                                                                                                                                         |
| --------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| \*        | (TBD - Depends on the balance) | <ul><li>Adjunct accounts prohibited</li><li>Contra accounts prohibited</li><li>Must be reconciled and cleared to a zero balance prior to period-end financial reporting</li></ul> |

## Application Bootstrap

For non-power users, we want to bootstrap their ledger accounts with a set of default accounts based on their domain.

### Individual

For the individual MVP, the following liability accounts will be bootstrapped:

#### Current Liabilities

- Short Term Debts: `200000` (control account)
- Payables: `201000` (control account)
- Suspense Accounts: `299000`

> [!NOTE]
> Long Term Loans (`204xxx`), Lease Liabilities (`205xxx`), and Provisions (`206xxx`) are **not** bootstrapped for the individual MVP. Type definitions exist for future use.

> [!NOTE]
> An opening balance equity account will also be created for each of the control accounts above.

## Domain Account Creation

Child creation methods accept an optional `controlAccountId` and require a caller-owned transaction. They lock the allocation root before resolving and locking the selected parent, enforce the existing parent and currency rules, and create the account with its final code and materialized path. Omitted parent IDs retain the existing family-specific default parents. Trade/statutory receivables and payables share their respective root allocation sequences; direct-cost variants share theirs.

Creation returns a version-1 entity and one complete creation event/audit. Bank and petty-cash opening dates are initialized during creation. Initial-opening journals own the posting-period check and Share lock. Use cases persist the prepared account/history and initial balance, commit, publish events, and submit any balance queue work after publication. Persistence never assigns codes or updates prepared domain entities. Existing historical audits and versions are unchanged.
