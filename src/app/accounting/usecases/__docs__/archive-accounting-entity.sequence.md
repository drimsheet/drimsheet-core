# Archive Accounting Entity

```mermaid
sequenceDiagram
    actor Caller
    participant Archive as Archive Accounting Entity
    participant Records as Accounting Records
    participant Accounting as Accounting Domain
    participant Selection as Current Entity Selection
    participant Events as Event Subscribers

    Caller->>Archive: Archive selected entity
    Archive->>Records: Request current entity
    Records-->>Archive: Entity or not found
    alt Entity not found
        Archive-->>Caller: Active entity not found
    else Entity found
        Archive->>Accounting: Request archival of current entity
        Accounting-->>Archive: Archived entity and changes, or unchanged entity
        alt Already archived
            Archive->>Selection: Clear current selection
            Archive-->>Caller: Complete
        else Archival required
            Archive->>Records: Save archival and audit; clear saved selections together
            Records-->>Archive: Changes committed; accounting records retained
            Archive->>Selection: Clear current selection
            Archive->>Events: Entity archived
            Archive-->>Caller: Complete
        end
    end
```
