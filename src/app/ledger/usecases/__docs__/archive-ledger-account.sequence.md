# Archive Ledger Account

```mermaid
sequenceDiagram
    actor Caller
    participant Archive as Archive Ledger Account
    participant Records as Accounting Records
    participant Accounts as Account Archival Preparation
    participant Events as Event Subscribers

    Caller->>Archive: Account ID and selected entity
    Archive->>Records: Request target account
    Records-->>Archive: Current account
    Archive->>Accounts: Request eligible archival
    Accounts->>Records: Request parent and applicable descendants
    Records-->>Accounts: Account hierarchy
    Accounts-->>Archive: Audited archival changes or rejection
    alt Missing or ineligible target
        Archive-->>Caller: Archival rejected
    else Target already archived
        Archive-->>Caller: Complete without account changes
    else Archival required
        Archive->>Records: Save target and descendant archival changes with audits together
        Records-->>Archive: Changes committed; journals and balances retained
        Archive->>Events: Accounts archived
        Archive-->>Caller: Complete
    end
```
