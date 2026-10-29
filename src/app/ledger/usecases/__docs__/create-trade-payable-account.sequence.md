# Create Trade Payable Account

```mermaid
sequenceDiagram
    actor Caller
    participant Create as Create Trade Payable Account
    participant Accounts as Account Preparation
    participant Records as Accounting Records
    participant Events as Event Subscribers

    Caller->>Create: Account details, selected entity, and parent choice
    Create->>Accounts: Prepare account and eligible hierarchy placement
    Accounts->>Records: Request parent and account-family facts
    Records-->>Accounts: Existing hierarchy and balances
    Accounts-->>Create: New account and optional parent promotion
    opt Existing posting parent needs promotion
        Create->>Records: Save new control and reparent original posting account
        Records-->>Create: Promotion prepared for commit
        Note over Accounts,Records: Original posting identity and journal references are preserved
    end
    Create->>Records: Save new account, initial balance, and audits
    Records-->>Create: Account creation and any promotion committed together
    Create->>Events: Account creation and any promotion events
    Create-->>Caller: Created account
```
