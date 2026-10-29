# Create Petty Cash Account

```mermaid
sequenceDiagram
    actor Caller
    participant Create as Create Petty Cash Account
    participant Accounts as Cash Account Preparation
    participant Opening as Opening Journal Preparation
    participant FX as Foreign Exchange Accounting
    participant Records as Accounting Records
    participant Events as Event Subscribers
    participant Balances as Balance Processing

    Caller->>Create: Account details, currency, and optional opening balance
    Create->>Accounts: Prepare account in selected entity and parent hierarchy
    Accounts-->>Create: New account and optional parent promotion
    opt Parent promotion required
        Create->>Records: Save control hierarchy while retaining original posting identity
        Records-->>Create: Promotion prepared for commit
    end
    opt Opening balance supplied
        Create->>Opening: Account, opening amount, date, and exchange rate
        Opening-->>Create: Validated draft or posted opening journal
        opt Opening journal posted
            Create->>FX: Prepare opening acquisition
            FX-->>Create: Applicable acquisition records or no effect
        end
    end
    Create->>Records: Save account details, balances, audits, and any journal, FX effect, and pending balance work
    Records-->>Create: Account setup and any promotion committed together
    Create->>Events: Account and any opening-journal or FX events
    opt Opening journal posted
        Create->>Balances: Request opening-journal balance propagation
        Balances-->>Create: Request accepted
    end
    Create-->>Caller: Created account with opening-balance information
```
