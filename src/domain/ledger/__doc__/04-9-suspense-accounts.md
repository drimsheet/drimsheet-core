# Suspense Accounts

## Table of Contents

- [Introduction](#introduction)
- [Asset Suspense Accounts](#asset-suspense-accounts-199xxx)
- [Liability Suspense Accounts](#liability-suspense-accounts-299xxx)
- [Shared Architecture](#shared-architecture)

## Introduction

Suspense accounts are temporary balance sheet accounts that are used to hold journal activity that cannot yet be classified to a specific account. They are typically used in the following scenarios:

- Bank Reconciliation
- Trial Balance Adjustments (for power users)
- Uncategorized journal activity

> [!IMPORTANT]
> By the end of the reporting period, all suspense accounts should be cleared to a zero balance.

Drimsheet permits one asset suspense account and one liability suspense account
per accounting entity and currency. The uniqueness key is
`(accountingEntityId, type, currency.code)` for subtype `suspense`. Archived and
soft-deleted accounts retain their slot; this creation API does not replace them.

`POST /ledger/suspense` accepts a name, asset/liability type, and currency code,
creating one account per request. Duplicates return a conflict. The domain service
checks for duplicates and the database enforces the same key with a scoped unique
index and a non-null suspense currency constraint.

The use case locks the accounting entity row before duplicate and latest-code
reads, then persists the account, creation history, and zero balance in the same
transaction. The lock spans all suspense currencies/types of that entity and is
released at commit or rollback. This works for the first account without creating
an artificial suspense header. Creation events are published after commit.

## Asset Suspense Accounts (199xxx)

In the Asset ledger, a suspense account typically carries a debit balance. It represents a "pre-classification" of value that the entity currently controls or has initiated. Here are some example use cases:

- Uncategorized credit-side journal activity during bank reconciliation
- Uncleared/unidentified outgoing payments

**Service method**: [`createAssetSuspense`](../services/suspense-account/suspense-account.service.ts)

## Liability Suspense Accounts (299xxx)

In the Liability ledger, a suspense account typically carries a credit balance. It represents an obligation that the entity has incurred but has not yet classified to a specific liability account. Here are some example use cases:

- Uncategorized debit-side journal activity during bank reconciliation
- Uncleared/unidentified incoming payments

**Service method**: [`createLiabilitySuspense`](../services/suspense-account/suspense-account.service.ts)

## Shared Architecture

Asset and liability suspense accounts are defined in
[`asset-account.types.ts`](../types/asset-account.types.ts) and
[`liability-account.types.ts`](../types/liability-account.types.ts):

| Property             | Value                     |
| -------------------- | ------------------------- |
| `subType`            | `'suspense'`              |
| `behavior`           | `'default'`               |
| `isControlAccount`   | `false`                   |
| `controlAccountId`   | `null`                    |
| `contraAccountRule`  | `'contra_not_permitted'`  |
| `adjunctAccountRule` | `'adjunct_not_permitted'` |
| `meta`               | `null`                    |

Asset and liability suspense accounts are distinguished by their ledger code prefix: asset suspense starts with `1` (`199xxx`) while liability suspense starts with `2` (`299xxx`).

Both variants are root posting accounts: their materialized path equals their
code. Asset codes begin at `199000`, liability codes at `299000`; each type's
sequence advances across currencies. The ordinary header-based allocator is not
used. Account creation remains independent of the recommendation endpoint.
