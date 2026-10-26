# Architecture & Chart of Accounts

> [!WARNING]
> This document is scoped to the following milestone:\
> https://github.com/Drimsheet/drimsheet-core/milestone/1 (v0.1.0 — Individual MVP)

## Journal Entries, Adjustments, and Propagation

Journal entries are the authoritative accounting record. Ledger balances are
eventually consistent values used primarily for reads and UI display.
Every ledger account has an initial balance created in the same transaction as
its account. A missing balance is an integrity failure: account enrichment
rejects with `BalanceNotFound` rather than substituting zero amounts.

- An **adjustment** changes one ledger account's balance.
- **Propagation** creates the corresponding adjustments for that account's
  control-account ancestors.

Use these terms in ledger code and documentation. Do not introduce another term
for derived balances or for bubbling adjustments through the account hierarchy.
An adjustment or propagation failure can leave displayed balances stale, but it
does not change the authoritative journal entry.

## Cash Account Currency Changes

Bank and petty-cash updates accept an optional `currencyCode`. A changed currency
requires no associated journal entry in any state, including drafts and opening
balances. A zero balance alone is insufficient. Repeating the existing currency
is a no-op. The new currency must remain compatible with the parent and every
existing descendant; updates do not cascade currency changes to other accounts.
This preserves LED-LA-003 and LED-LA-008.

The cash domain update methods load and lock the target account. For currency
edits, they first lock the cash-family header, matching child creation. The
reference and hierarchy checks run in the use case’s transaction.
The cash domain service validates eligibility and returns only the audited ledger
account tuple, following the account-creation convention. The use case persists
the account, its actor-attributed history, and the balance currency together.
The ledger-account-balance domain service compares the previous and updated
accounts and returns the previous balance when the currency is unchanged.
It delegates a changed currency to the balance entity, which only changes the denomination of a zero transaction and
functional balance, preserving identity and creation attribution. Its update
uses the version read under the account lock and creates no journal adjustment.
A missing balance, nonzero balance, or version conflict rolls back the update.
Opening-journal work remains a
separate application capability when explicitly supplied in the update request.

Journal persistence takes Share locks on referenced accounts and checks current
currencies before writing prepared lines. If a currency edit wins the lock, a
journal prepared with the old currency is rejected. If a journal write wins,
the currency edit sees its reference after acquiring the account lock and is
rejected. This applies to both journal creation and rectification.

## Account Archiving

`POST /ledger/{accountId}/archive` accepts only the account ID, requires no request
body, and returns HTTP 204 with no content. It retains the account and all historical
journal references. Header accounts (`controlAccountId === null`) cannot be
archived. Repeating archive is a no-op; stale repository writes conflict.
Archiving a child of a draft control account is rejected by the domain status
invariant. An entire draft subtree can be archived beneath an active parent.
Control-account archive includes every descendant in one transaction with one
actor-attributed archive audit and event per changed account.

`ledgerAccountService.archive` accepts the supplied account, queries descendants by
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

## Account Deletion

`DELETE /ledger/{accountId}` requires accounting-entity ownership and returns
HTTP 204 with no content. Accounts without a `controlAccountId` cannot be
deleted, regardless of status. Each account must be draft or have no associated
journal entries. A control account includes its complete subtree; every
descendant must pass the same `canDelete` check or the entire request is rejected.
All journals associated with draft accounts must themselves be draft.
A non-draft journal (including an archived never-posted entry), or a draft with
posting history, is an unexpected invariant violation and aborts deletion.

All associated draft journal aggregates are removed, including every line
(also lines for accounts outside the deleted subtree), attachment association,
and journal audit record. `ledgerAccountService.delete` validates the subtree
and returns the prepared deletion records without persisting. Accounts are
then removed child-first with their audit history; existing database cascades
remove bank details and initial balances. The complete operation commits or
rolls back together.

The use case locks the target and fetched descendants while validating and
deleting their journal entries. A concurrent descendant insertion that escapes
the subtree read causes a foreign-key conflict and rolls back the deletion.
Journal and account version checks reject concurrent changes. The account
repository additionally requires no remaining journal lines, preventing
partial journal deletion through database cascades. This preserves LED-LA-009
and LED-LA-012, and the journal guarantees JE-006, JE-011, and JE-012.

## Chart of Accounts Structure

Our Chart of Accounts follows a **6-digit** hierarchical coding structure: **A-BB-CCC**. Where:

- **A** (1 digit) represents the primary account class (1=Asset, 2=Liability, 3=Equity, 4=Revenue, 5=Expense)
- **BB** (2 digits) represents the account group / sub-header (e.g. Cash and Cash Equivalents, Retained Earnings, etc.)
- **CCC** (3 digits) represents the control account or sub-ledger (sequentially allocated)

Domain creation services allocate codes through `ledgerAccountService.getNextCode` under the caller-owned transaction. The caller locks the family root before the service reads the latest subtype code. Allocation spans behaviors, parents, and currencies within the accounting entity/type/subtype, with a 999-account limit per family.

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

`ledgerAccountEntity` owns ledger-code generation: family-prefix derivation,
predecessor validation, reserved-code selection, and sequence limits. Services
retrieve the latest persisted code and delegate to `getNextCode`. Suspense
creation uses the entity's `getSuspenseCode` to retain its initial-code behavior.

A draft control account can only receive draft children, including nested control
accounts. Creation services validate the resolved child status in the domain
before allocating a code or returning a new account. Omitting status retains the
existing active default, so omission under a draft parent is rejected rather
than silently converted to draft. Active parents may receive active or draft
children; archived-parent restrictions continue to apply.

Child creation methods accept an optional `controlAccountId` and require a caller-owned transaction. They lock the allocation root before resolving and locking the selected parent, enforce the existing parent and currency rules, and create the account with its final code and materialized path. Omitted parent IDs retain the existing family-specific default parents. Trade/statutory receivables and payables share their respective root allocation sequences; direct-cost variants share theirs.

Creation returns a version-1 entity and one complete creation event/audit, plus an optional prepared promotion as the fourth tuple item. Bank and petty-cash opening dates are initialized during creation. Initial-opening journals own the posting-period check and Share lock. Use cases persist the prepared account/history and initial balance, commit, publish events, and submit any balance queue work after publication. Persistence never assigns codes or updates prepared domain entities. Existing historical audits and versions are unchanged.

### Control Account Promotion (Dynamic Nesting)

When a child-creation request selects a posting account as `controlAccountId`,
the family domain service first validates the selected parent’s status, family,
behavior, and currency. It then prepares promotion before calling
`ledgerAccountService.getNextCode` for the requested child. Existing control
parents retain the usual creation path. Posting parents can be promoted with or
without existing journals; draft parents still require draft children.

The domain’s `clonePostingAccountToControlAccount` entity operation creates a
new control account at the original account's code and materialized path,
inheriting its parent. The domain service also prepares its initial balance
from the posting account’s existing amounts. The original posting account retains its ID, financial
classification, currency, metadata, opening date, and journal references. It
receives the next available family code, moves under the new control account,
and retains its name unless the client supplies `promotionNames`. This optional
object contains `newControlAccountName` and `newPostingAccountName`, allowing
clients to supply localized names. When omitted, both accounts retain the
original name. Supplied names follow the usual account-name validation, and
are ignored when the selected parent is already a control account. The requested
child keeps its own request name and is created alongside the original posting
account. For example, with client-supplied promotion names:

```text
Before: 401000.401001                 Consulting (posting)
After:  401000.401001                 Consulting (new control)
        401000.401001.401002          Consulting (default; original ID)
        401000.401001.401003          Requested child
```

The domain returns the audited parent creation and posting-account update,
plus prepared balances and cloned adjustment history. Child allocation excludes
the code already reserved for the original posting account. Both new codes must
fit the existing family capacity. Domain services never persist these records.

The use case persists promotion and child creation in one transaction, with
actor-attributed histories and events published after commit. The persistence
service uses ordinary repository calls: update the original posting account,
create the new control account, update the posting balance, and create the
control balance together with its prepared adjustment history through
`createWithAdjustments`. Ordinary balance creation continues to use `create`.
The domain clones adjustments with new IDs while retaining journal references,
signed amounts, currencies, effects, original actors, and timestamps, including
voided originals and reversals. Saving history does not apply the amounts again.
The use case then persists the requested child. The parent foreign key is deferred until
transaction commit so the update may reference the new parent before insertion;
code/path uniqueness remains immediate. A missing parent still prevents commit.
No journal lines are rewritten.
This preserves LED-LA-002, LED-LA-003, LED-LA-005, and LED-LA-009–012.

The original balance keeps its amounts and receives the new path and version;
the new control balance starts with those already-propagated amounts. Existing
ancestors are unchanged, preventing double-counting. Pending journal propagation
uses the new hierarchy. A propagation preparation whose account paths disagree
with its later balance reads rejects for retry; optimistic balance versions
protect writes prepared before promotion. A concurrent balance write also
causes promotion to roll back rather than seed the parent from stale amounts.
