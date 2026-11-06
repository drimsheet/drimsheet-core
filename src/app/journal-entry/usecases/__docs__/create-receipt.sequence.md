# Create Receipt

```mermaid
sequenceDiagram
    actor Caller
    participant CreateUseCase as Create Receipt
    participant Records as Accounting Records
    participant Parties as Counterparties
    participant Files as Uploaded Attachments
    participant Journal as Journal Preparation
    participant FX as Foreign Exchange Accounting
    participant Balances as Balance Processing
    participant Events as Event Subscribers

    Caller->>CreateUseCase: Sources, destination, amounts, dates, counterparty IDs, and uploads
    CreateUseCase->>Records: Request referenced accounts in selected entity
    Records-->>CreateUseCase: Accounts
    CreateUseCase->>Parties: Resolve existing counterparties by ID
    Parties-->>CreateUseCase: Existing counterparties
    CreateUseCase->>Files: Claim the user's referenced uploads
    Files-->>CreateUseCase: Journal attachments
    CreateUseCase->>Journal: Requested receipt with accounts, parties, and attachments
    Journal-->>CreateUseCase: Validated draft or posted journal and audit
    CreateUseCase->>FX: Destination foreign-exchange acquisition
    FX-->>CreateUseCase: Applicable FX records and events, or no effect
    CreateUseCase->>Records: Save journal, audits, FX effects, and pending balance work together
    Records-->>CreateUseCase: Changes committed
    CreateUseCase->>Events: Journal and applicable FX events
    opt Journal posted
        CreateUseCase->>Balances: Request journal balance propagation
        Balances-->>CreateUseCase: Request accepted
    end
    CreateUseCase-->>Caller: Created journal
    Note over CreateUseCase,Balances: Derived balances are applied separately after posting
```
