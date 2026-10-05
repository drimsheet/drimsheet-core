# Architecture & Chart of Accounts

> [!WARNING]
> This document is scoped to the following milestone:\
> https://github.com/Drimsheet/drimsheet-core/milestone/1 (v0.1.0 — Individual MVP)

## Journal Entries, Adjustments, and Propagation

Journal entries are the authoritative accounting record. Ledger balances are
eventually consistent values used primarily for reads and UI display.

- An **adjustment** changes one ledger account's balance.
- **Propagation** creates the corresponding adjustments for that account's
  control-account ancestors.

Use these terms in ledger code and documentation. Do not introduce another term
for derived balances or for bubbling adjustments through the account hierarchy.
An adjustment or propagation failure can leave displayed balances stale, but it
does not change the authoritative journal entry.

## Account Archiving

`POST /ledger/{accountId}/archive` accepts only the account ID, requires no request
body, and returns HTTP 204 with no content. It retains the account and all historical
journal references. Header accounts (`controlAccountId === null`) cannot be
archived. Repeating archive is a no-op; stale repository writes conflict.
Control-account archive includes every descendant in one transaction with one
actor-attributed archive audit and event per changed account.

The archive domain service accepts the supplied account, queries descendants by
its complete materialized path, and returns audited tuples. It does not re-fetch
the target, resolve the allocation root, or compare an expected version.

Archived accounts cannot be associated with new journals, whether draft or
posted, including generated reversals. Consequently corrections and reversing
deletions that reference archived original accounts are rejected. Existing
journals, historical transactions, and reporting inputs remain readable.

The public ledger list defaults to `status=active`; explicit `status=draft` and
`status=archived` queries expose those states. Posting-account discovery includes
active/draft candidates and excludes archived accounts. Repository reads without
a status filter remain unfiltered so pending propagation for existing posted
journals still includes archived accounts and control ancestors. Report totals
must use these historical inputs rather than the public active-list default.

Journal creation checks account status internally, including unposted entries
and implicit opening-balance equity accounts. Rectification and reversal domain
operations read the referenced accounts and reject archived accounts before
preparing new associations. Use cases persist the prepared results without a
separate account-validation call. These preparation checks do not hold account
locks through journal persistence. The archive workflow never changes journals,
balances, FX records, or propagation work.

## Chart of Accounts Structure

Our Chart of Accounts follows a **6-digit** hierarchical coding structure: **A-BB-CCC**. Where:

- **A** (1 digit) represents the primary account class (1=Asset, 2=Liability, 3=Equity, 4=Revenue, 5=Expense)
- **BB** (2 digits) represents the account group / sub-header (e.g. Cash and Cash Equivalents, Retained Earnings, etc.)
- **CCC** (3 digits) represents the control account or sub-ledger (sequentially allocated)

Domain creation services allocate codes through `ledgerCodeAllocationService.getNextCode` under the caller-owned transaction. The allocator locks the family root before reading the latest subtype code. Allocation spans behaviors, parents, and currencies within the accounting entity/type/subtype, with a 999-account limit per family.

Power users can set a display code for accounts, but the internal code will always follow the above structure.

## Metadata-Driven Account Behavior

Instead of hardcoding account behavior into the ledger codes (e.g. using a specific suffix digit for contra or adjunct accounts), Drimsheet uses a **metadata-driven** architecture.

A ledger account's behavior and system constraints are defined by its properties in the database, as modeled in `ledger.types.ts`:

| Property             | Type                  | Purpose                                                                                            |
| -------------------- | --------------------- | -------------------------------------------------------------------------------------------------- |
| `type`               | `ULedgerType`         | Primary classification (Asset, Liability, Equity, Revenue, Expense)                                |
| `normalBalance`      | `UNormalBalance`      | Debit or Credit — auto-derived from `type`                                                         |
| `subType`            | string                | "What it is" — account classification within its type (e.g. `cash_and_cash_equivalent`, `payable`) |
| `behavior`           | string                | "How it acts" — operational semantics (e.g. `bank`, `petty_cash`, `tax_payable`)                   |
| `isControlAccount`   | boolean               | Whether this account is a Header Account or Control Account                                        |
| `controlAccountId`   | UUID \| null          | FK linking a sub-ledger to its Control Account                                                     |
| `contraAccountRule`  | `UContraAccountRule`  | Whether contra accounts are permitted, required, or prohibited                                     |
| `adjunctAccountRule` | `UAdjunctAccountRule` | Whether adjunct accounts are permitted, required, or prohibited                                    |
| `meta`               | object \| null        | Account-specific metadata (e.g. `IBankAccountMeta`, `IStatutoryPayableAccountMeta`)                |

### Adjustment Accounts (Contra & Adjunct)

Adjustment accounts are modeled relationally rather than via ledger code conventions. An adjustment account carries an `IAdjustmentMetaData` in its `meta` field:

```typescript
interface IAdjustmentMetaData {
  adjustmentType: UAdjustmentType; // 'contra' | 'adjunct'
  targetAccountId: TEntityId; // FK → basis account
}
```

This enables:

- A single basis account to have **multiple** contra accounts (e.g., Accumulated Depreciation AND Impairment Loss)
- Dynamic reporting adaptation without exhausting/reserving specific ledger code slots
- Clean separation between the account hierarchy and the adjustment relationship

> [!NOTE]
> For users who migrate from other systems, we will preserve their ledger codes at the DB level (`external_ledger_code`) but internally follow our strict nomenclature. Users can choose which code to display on the UI.

> [!NOTE]
> A more contrived view will be displayed for non-accountant users in the individual accounting domain. Nonetheless, under the hood, this will be the complete structure.

## Entity Architecture

Each ledger account type follows a consistent factory pattern:

1. **Type definitions** in `src/domain/ledger/types/` — progressive interface narrowing from `ILedgerAccount` → `I{Type}LedgerAccount` → `I{SubType}Account`
2. **Entity factories** in `src/domain/ledger/entities/{NN}-{type}-account/` — `make()` and `getCode()` functions
3. **Domain events** in `src/domain/ledger/events/` — emitted on every entity creation
4. **Shared factory** in `src/domain/ledger/entities/shared/ledger-account.entity.ts` — validates all base properties and constructs the frozen entity

Entity files are named by their COA prefix to make it explicit which accounts have been implemented and which are still pending:

```
services/
├── cash-account.service.ts             ← 100xxx ✅
├── receivables-account.service.ts      ← 102xxx ✅
└── suspense-account.service.ts         ← 199xxx / 299xxx ✅
                                           101xxx (Short Term Investments) — not yet implemented
```

## Domain Account Creation

Child creation methods accept an optional `controlAccountId` and require a caller-owned transaction. They lock the allocation root before resolving and locking the selected parent, enforce the existing parent and currency rules, and create the account with its final code and materialized path. Omitted parent IDs retain the existing family-specific default parents. Trade/statutory receivables and payables share their respective root allocation sequences; direct-cost variants share theirs.

Creation returns a version-1 entity and one complete creation event/audit. Bank and petty-cash opening dates are initialized during creation. Initial-opening journals own the posting-period check and Share lock. Use cases persist the prepared account/history and initial balance, commit, publish events, and submit any balance queue work after publication. Persistence never assigns codes or updates prepared domain entities. Existing historical audits and versions are unchanged.
