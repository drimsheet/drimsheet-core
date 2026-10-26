# Delete Accounting Entity

```mermaid
sequenceDiagram
    actor Caller
    participant Delete as Delete Accounting Entity
    participant Records as Accounting Records
    participant Accounting as Accounting Domain
    participant Selection as Current Entity Selection
    participant Events as Event Subscribers

    Caller->>Delete: Delete selected entity
    Delete->>Records: Request current entity
    Records-->>Delete: Entity or not found
    alt Entity not found
        Delete-->>Caller: Active entity not found
    else Entity found
        Delete->>Accounting: Request deletion eligibility
        Accounting->>Records: Does the entity have any journal entries?
        Records-->>Accounting: Journal reference status
        alt Journal entries exist
            Accounting-->>Delete: Deletion rejected
            Delete-->>Caller: Entity with journal entries cannot be deleted
        else Eligible for deletion
            Accounting-->>Delete: Entity deletion and event
            Delete->>Records: Remove entity and related setup; clear saved selections together
            Records-->>Delete: Removal committed; audit history retained
            Delete->>Selection: Clear current selection
            Delete->>Events: Entity deleted
            Delete-->>Caller: Complete
        end
    end
```
