# Create Receipt

```mermaid
sequenceDiagram
    actor Caller
    participant Create as Create Receipt
    participant Records as Accounting Records
    participant Parties as Counterparties
    participant Files as Uploaded Attachments
    participant Journal as Journal Preparation
    participant FX as Foreign Exchange Accounting
    participant Balances as Balance Processing
    participant Events as Event Subscribers

    Caller->>Create: Sources, destination, amounts, dates, counterparties, and uploads
    Create->>Records: Request referenced accounts in selected entity
    Records-->>Create: Accounts
    Create->>Parties: Resolve existing or new counterparties
    Parties-->>Create: Counterparties and any new records
    Create->>Files: Claim the user's referenced uploads
    Files-->>Create: Journal attachments
    Create->>Journal: Requested receipt with accounts, parties, and attachments
    Journal-->>Create: Validated draft or posted journal and audit
    Create->>FX: Destination foreign-exchange acquisition
    FX-->>Create: Applicable FX records and events, or no effect
    Create->>Records: Save journal, new parties, audits, FX effects, and pending balance work together
    Records-->>Create: Changes committed
    opt Journal posted
        Create->>Balances: Request journal balance propagation
        Balances-->>Create: Request accepted
    end
    Create->>Events: Journal, counterparty, and applicable FX events
    Create-->>Caller: Created journal
    Note over Create,Balances: Derived balances are applied separately after posting
```
