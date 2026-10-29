# Create Opening Balance

```mermaid
sequenceDiagram
    actor Caller
    participant Create as Create Opening Balance
    participant Records as Accounting Records
    participant Opening as Opening Balance Preparation
    participant FX as Foreign Exchange Accounting
    participant Balances as Balance Processing
    participant Events as Event Subscribers

    Caller->>Create: Account ID, opening amount, date, and exchange rate
    Create->>Records: Request account in selected entity
    Records-->>Create: Account or not found
    alt Account missing
        Create-->>Caller: Account not found
    else Account found
        Create->>Opening: Request opening journal for account
        Opening->>Records: Request opening equity account and eligibility facts
        Records-->>Opening: Required accounts and existing activity
        Opening->>FX: Prepare applicable opening acquisition
        FX-->>Opening: FX effect or no effect
        Opening-->>Create: Validated opening journal, audit, and associated effects
        Note over Opening,Create: Draft accounts produce drafts; other eligible accounts produce posted entries
        Create->>Records: Save journal, changed opening date, audits, FX effect, and pending balance work together
        Records-->>Create: Changes committed
        opt Opening journal posted
            Create->>Balances: Request opening balance propagation
            Balances-->>Create: Request accepted
        end
        Create->>Events: Account, journal, and applicable FX events
        Create-->>Caller: Complete
    end
```
