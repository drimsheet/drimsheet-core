# Adjust Ledger Account Balance

```mermaid
sequenceDiagram
    actor Worker as Balance Worker
    participant Adjust as Adjust Ledger Account Balance
    participant Records as Accounting Records
    participant Preparation as Balance Adjustment Preparation
    participant Reporting as Operational Reporting

    Worker->>Adjust: Journal-entry ID
    Adjust->>Records: Request pending balance-propagation work
    Records-->>Adjust: Pending work or none
    alt No pending work
        Adjust->>Reporting: Report missing balance-propagation work
        Adjust-->>Worker: Complete without adjustments
    else Pending work exists
        Adjust->>Preparation: Prepare journal balance effects
        Preparation->>Records: Request journal, affected accounts, ancestors, and balances
        Records-->>Preparation: Journal and current balance facts
        Preparation-->>Adjust: Validated account adjustments
        Adjust->>Records: Save adjustments and remove pending work together
        Records-->>Adjust: Balance changes committed
        Adjust-->>Worker: Complete
    end
    Note over Adjust,Records: Validation or write failures reject; incomplete changes do not commit
```
