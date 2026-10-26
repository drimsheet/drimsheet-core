# Activate Cash Account

```mermaid
sequenceDiagram
    actor Caller
    participant Activate as Activate Cash Account
    participant Accounts as Cash Account Preparation
    participant Records as Accounting Records
    participant Opening as Opening Posting Preparation
    participant Events as Event Subscribers
    participant Balances as Balance Processing

    Caller->>Activate: Account ID and whether to post its draft opening balance
    Activate->>Records: Request account in selected entity
    Records-->>Activate: Current account
    Activate->>Accounts: Request eligible activation
    Accounts-->>Activate: Activated account and any changes
    opt Opening posting requested
        Activate->>Records: Request existing draft opening journal
        Records-->>Activate: Opening draft or none
        opt Opening draft exists
            Activate->>Opening: Prepare posting for activated account
            Opening-->>Activate: Posting, audit, and applicable FX acquisition
        end
    end
    alt No account or journal changes
        Activate-->>Caller: Complete without new effects
    else Changes prepared
        Activate->>Records: Save activation, opening posting, audits, FX effects, and pending balance work together
        Records-->>Activate: Changes committed
        Activate->>Events: Account and any opening-posting or FX events
        opt Opening journal posted
            Activate->>Balances: Request opening-journal balance propagation
            Balances-->>Activate: Request accepted
        end
        Activate-->>Caller: Complete
    end
```
