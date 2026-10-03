# Revenue Accounts

## Table of Contents

- [Introduction](#introduction)
- [Operating Revenues](#operating-revenues)
  - [Sales](#sales)
  - [Services](#services)
  - [Subscriptions](#subscriptions)
  - [Employment Income](#employment-income)
- [Non-Operating Revenues](#non-operating-revenues)
  - [Interest Income](#interest-income)
  - [Gain on Sale of Assets](#gain-on-sale-of-assets)
  - [Unrealized Gains](#unrealized-gains)
  - [Grants](#grants)
  - [Gifts](#gifts)
- [Application Bootstrap](#application-bootstrap)
  - [Individual](#individual)

## Introduction

Revenue ledgers are used to track the income earned by an individual, sole trader, or company from its normal business operations and other incidental activities. Per our [accounting philosophy](../../accounting/__doc__/accounting.md#philosophy), our revenue ledgers are structured with reporting in mind to distinctly separate core operational performance from other income sources.

Revenue ledgers come in two reporting hierarchies:

- Operating Revenues
- Non-Operating Revenues

When a revenue ledger/sub-ledger is created, it MUST be associated with one of the two reporting hierarchies.

By default, standard revenue accounts carry a **credit** normal balance. **Contra-revenue accounts** (like Returns and Discounts) carry a **debit** normal balance as they act to reduce gross revenue. Contra-revenue accounts are created relationally within their Control Account's code range and are distinguished by their flipped `normalBalance` and `IAdjustmentMetaData`.

To ensure our system is extensible, we have not baked functionalities into ledger codes or predefined accounts. For non-power users, our ledger accounts bootstrap will handle the creation of accounts and association of behaviors. For power users, they can create accounts and associate behaviors available to the account class.

### Implementation Status

| Account Group     | Code Block | Entity File                                                                         | Status         |
| ----------------- | ---------- | ----------------------------------------------------------------------------------- | -------------- |
| Sales             | `400xxx`   | —                                                                                   | 🔲 Types only  |
| Services          | `401xxx`   | [`02-services.entity.ts`](../revenue/entities/services.entity.ts)                   | ✅ Implemented |
| Subscriptions     | `402xxx`   | —                                                                                   | 🔲 Types only  |
| Employment Income | `403xxx`   | [`04-employment-income.entity.ts`](../revenue/entities/employment-income.entity.ts) | ✅ Implemented |
| Interest Income   | `404xxx`   | —                                                                                   | 🔲 Types only  |
| Gain on Sale      | `405xxx`   | [`06-gain-on-sale.entity.ts`](../revenue/entities/gain-on-sale.entity.ts)           | ✅ Implemented |
| Unrealized Gains  | `406xxx`   | [`07-unrealized-gain.entity.ts`](../revenue/entities/unrealized-gain.entity.ts)     | ✅ Implemented |
| Grants            | `407xxx`   | [`grants.entity.ts`](../revenue/entities/grants.entity.ts)                          | ✅ Implemented |
| Gifts             | `408xxx`   | [`gifts.entity.ts`](../revenue/entities/gifts.entity.ts)                            | ✅ Implemented |

> [!NOTE]
> Entity files are named by their COA prefix (e.g. `02-` = `401xxx`, `04-` = `403xxx`) to make it explicit which accounts have been implemented and which are pending.

The following table shows the behaviors of different revenue account classes:

## Operating Revenues

### Sales

- **Ledger codes**: 400xxx
- **Description**: accounts used to track gross revenue earned from the sale of physical goods or products.
- **Main reporting hierarchy**: Operating Revenues / Sales

> [!NOTE]
> Entity implementation pending. Types defined in [`revenue-account.types.ts`](../types/revenue-account.types.ts).\
> Not in scope for individual MVP (individuals don't sell goods).

#### Behaviors

| Sub-Class | Reporting Hierarchy | Behaviors                                                                                                                                                                                                                                                                                                                                                    |
| --------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Sales     | /                   | <ul><li>Requires sales invoice or cash receipt transaction for creation</li><li>Automatically closed to Retained Earnings at period-end</li><li>Supports adjunct accounts</li><li>Contra accounts (Returns, Refunds, Discounts) are created relationally within the 400xxx range with a flipped normal balance and mandatory `IAdjustmentMetaData`</li></ul> |

### Services

- **Ledger codes**: 401xxx
- **Description**: accounts used to track gross revenue earned from providing professional services, consulting, or labor.
- **Main reporting hierarchy**: Operating Revenues / Services

#### Behaviors

| Sub-Class | Reporting Hierarchy | Behaviors                                                                                                                                                                                                                                                                                                                                      |
| --------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Services  | /                   | <ul><li>Requires sales invoice or payment receipt transaction for creation</li><li>**Requires counterparty location metadata** for accurate statutory/tax calculations (e.g., VAT/WHT/Export)</li><li>Supports accrual rules out of Unbilled Assets (Accrued Income)</li><li>Automatically closed to Retained Earnings at period-end</li></ul> |

#### Entity Details

The `Services` entity ([`02-services.entity.ts`](../revenue/entities/services.entity.ts)) creates accounts with:

- Fixed `behavior: 'services'` / `subType: 'services'`
- `contraAccountRule: 'contra_not_permitted'` / `adjunctAccountRule: 'adjunct_not_permitted'`
- Accepts `isControlAccount`, `controlAccountId`, and `meta` via payload

### Subscriptions

- **Ledger codes**: 402xxx
- **Description**: accounts used to track recurring revenue from subscripted access to products, software, or ongoing services.
- **Main reporting hierarchy**: Operating Revenues / Subscriptions

> [!NOTE]
> Entity implementation pending. Types defined in [`revenue-account.types.ts`](../types/revenue-account.types.ts).\
> Not in scope for individual MVP.

#### Behaviors

| Sub-Class     | Reporting Hierarchy | Behaviors                                                                                                                                                                                                                        |
| ------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subscriptions | /                   | <ul><li>Requires recurring invoice or deferred revenue amortization schedule for creation</li><li>Supports automated revenue recognition run schedules</li><li>Automatically closed to Retained Earnings at period-end</li></ul> |

### Employment Income

- **Ledger codes**: 403xxx
- **Description**: accounts used to track gross salary, wages, and other employment compensation received from an employer (subject to PAYE).
- **Main reporting hierarchy**: Operating Revenues / Employment Income

#### Behaviors

| Sub-Class         | Reporting Hierarchy | Behaviors                                                                                                                                                                                                                                                                                                                                                    |
| ----------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Employment Income | /                   | <ul><li>**Requires Employer Onboarding** to capture contract nature, jurisdiction/location, and tax responsibility (e.g., PAYE obligation)</li><li>Requires a payslip or net deposit journal for creation</li><li>Supports gross-to-net accounting (tracking PAYE, Pensions, etc.)</li><li>Automatically closed to Retained Earnings at period-end</li></ul> |

#### Entity Details

The `EmploymentIncome` entity ([`04-employment-income.entity.ts`](../revenue/entities/employment-income.entity.ts)) creates accounts with:

- Fixed `behavior: 'employment_income'` / `subType: 'employment_income'`
- `contraAccountRule: 'contra_not_permitted'` / `adjunctAccountRule: 'adjunct_not_permitted'`
- Accepts `isControlAccount`, `controlAccountId`, and `meta` via payload

## Non-Operating Revenues

### Interest Income

- **Ledger codes**: 404xxx
- **Description**: accounts used to track income earned from cash balances, term deposits, or financing provided to others, separated from core operational performance.
- **Main reporting hierarchy**: Non-Operating Revenues / Interest Income

> [!NOTE]
> Entity implementation pending. Types defined in [`revenue-account.types.ts`](../types/revenue-account.types.ts).\
> Not in scope for individual MVP.

#### Behaviors

| Sub-Class       | Reporting Hierarchy | Behaviors                                                                                                                                                                                                                                          |
| --------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Interest Income | /                   | <ul><li>Requires bank statement reconciliation or automated interest accrual schedule</li><li>Often linked directly as an adjunct to Short/Long Term Investment accounts</li><li>Automatically closed to Retained Earnings at period-end</li></ul> |

### Gain on Sale of Assets

- **Ledger codes**: 405xxx
- **Description**: accounts used to track the net financial gain resulting from the disposal/sale of Property, Plant & Equipment or Long Term Investments above their carrying (book) value.
- **Main reporting hierarchy**: Non-Operating Revenues / Gain on Sale of Assets

#### Behaviors

| Sub-Class    | Reporting Hierarchy | Behaviors                                                                                                                                                                                                                  |
| ------------ | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gain on Sale | /                   | <ul><li>Requires an asset disposal transaction for creation</li><li>Automatically calculates difference between sale proceeds and net book value</li><li>Automatically closed to Retained Earnings at period-end</li></ul> |

#### Entity Details

The `GainOnAssetSale` entity ([`06-gain-on-sale.entity.ts`](../revenue/entities/gain-on-sale.entity.ts)) creates accounts with:

- Fixed `behavior: 'gain_on_asset_sale'` / `subType: 'gain_on_asset_sale'`
- `contraAccountRule: 'contra_not_permitted'` / `adjunctAccountRule: 'adjunct_not_permitted'`
- Accepts `isControlAccount`, `controlAccountId`, and `meta` via payload

### Unrealized Gains

- **Ledger codes**: 406xxx
- **Description**: accounts used to track positive mark-to-market valuations (paper gains) on short-term trading assets, marketable securities, or foreign exchange balances before they are sold or settled.
- **Main reporting hierarchy**: Non-Operating Revenues / Unrealized Gains

#### Behaviors

| Sub-Class        | Reporting Hierarchy | Behaviors                                                                                                                                                                                                                    |
| ---------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unrealized Gains | /                   | <ul><li>Created via automated period-end revaluation runs or manual mark-to-market journal entries</li><li>Counterpart to an asset adjunct account</li><li>Automatically closed to Retained Earnings at period-end</li></ul> |

#### Entity Details

The `UnrealizedGain` entity ([`07-unrealized-gain.entity.ts`](../revenue/entities/unrealized-gain.entity.ts)) creates accounts with:

- Fixed `behavior: 'unrealized_gains'` / `subType: 'unrealized_gains'`
- `contraAccountRule: 'contra_not_permitted'` / `adjunctAccountRule: 'adjunct_not_permitted'`
- Accepts `isControlAccount`, `controlAccountId`, and `meta` via payload

### Grants

- **Ledger codes**: 407xxx
- **Description**: accounts used to track grant income recognized by the accounting entity. Conditional or deferred grant recognition is handled outside the account taxonomy.
- **Main reporting hierarchy**: Non-Operating Revenues / Grants

#### Behaviors

| Sub-Class | Reporting Hierarchy | Behaviors                                                                                                                                                                                                                            |
| --------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Grants    | /                   | <ul><li>Captures recognized grant income in its own reporting bucket</li><li>Does not encode restriction or deferred recognition policy in the ledger code</li><li>Automatically closed to Retained Earnings at period-end</li></ul> |

#### Entity Details

The `Grants` entity ([`grants.entity.ts`](../revenue/entities/grants.entity.ts)) creates accounts with:

- Fixed `behavior: 'grants'` / `subType: 'grants'`
- `contraAccountRule: 'contra_not_permitted'` / `adjunctAccountRule: 'adjunct_not_permitted'`
- Accepts `isControlAccount`, `controlAccountId`, and `meta` via payload

### Gifts

- **Ledger codes**: 408xxx
- **Description**: accounts used to track voluntary gifts or donations received by the accounting entity.
- **Main reporting hierarchy**: Non-Operating Revenues / Gifts

#### Behaviors

| Sub-Class | Reporting Hierarchy | Behaviors                                                                                                                                                                            |
| --------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gifts     | /                   | <ul><li>Captures voluntary gifts and donations received</li><li>Represents gifts received, not gifts given</li><li>Automatically closed to Retained Earnings at period-end</li></ul> |

#### Entity Details

The `Gifts` entity ([`gifts.entity.ts`](../revenue/entities/gifts.entity.ts)) creates accounts with:

- Fixed `behavior: 'gifts'` / `subType: 'gifts'`
- `contraAccountRule: 'contra_not_permitted'` / `adjunctAccountRule: 'adjunct_not_permitted'`
- Accepts `isControlAccount`, `controlAccountId`, and `meta` via payload

## Application Bootstrap

For non-power users, we want to bootstrap their ledger accounts with a set of default accounts based on their domain.

### Individual

For the individual MVP, the following revenue accounts will be bootstrapped:

#### Operating Revenues

- Services: `401000` (control account)
- Employment Income: `403000` (control account)

#### Non-Operating Revenues

- Gain on Sale of Assets: `405000` (control account)
- Unrealized Gains: `406000` (control account)
- Grants: `407000` (control account)
- Gifts: `408000` (control account)

> [!NOTE]
> Sales (`400xxx`), Subscriptions (`402xxx`), and Interest Income (`404xxx`) are **not** bootstrapped for the individual MVP. Type definitions exist for future use.

> [!NOTE]
> All revenue ledgers are automatically cleared and closed out to `RetainedEarnings (301000)` at the end of the financial/accounting period.
> \n

<figure>
<img src="./assets/4-coa-revenues.svg" alt="Revenues Chart of Accounts" style="max-width: 100%; width: auto; max-height: 600px;">
<figcaption>

_Figure: View the mermaid sourcecode here: _[_4-coa-revenues.mermaid_](./assets/4-coa-revenues.mermaid)

</figcaption>
</figure>

## Domain Account Creation

Child creation methods accept an optional `controlAccountId` and require a caller-owned transaction. They lock the allocation root before resolving and locking the selected parent, enforce the existing parent and currency rules, and create the account with its final code and materialized path. Omitted parent IDs retain the existing family-specific default parents. Trade/statutory receivables and payables share their respective root allocation sequences; direct-cost variants share theirs.

Creation returns a version-1 entity and one complete creation event/audit. Bank and petty-cash opening dates are initialized during creation. Initial-opening journals own the posting-period check and Share lock. Use cases persist the prepared account/history and initial balance, commit, publish events, and submit any balance queue work after publication. Persistence never assigns codes or updates prepared domain entities. Existing historical audits and versions are unchanged.
