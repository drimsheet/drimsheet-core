# Ingest Exchange Rate

```mermaid
sequenceDiagram
    actor Worker as Ingestion Worker
    participant Ingest as Exchange Rate Ingestion
    participant Provider as Exchange Rate Provider
    participant Rates as Rate Validation
    participant Records as Stored Exchange Rates

    Worker->>Ingest: Optional date range and current actor
    Note over Worker,Ingest: Defaults span two years before now through now
    Ingest->>Provider: Request observations for date range
    Provider-->>Ingest: Exchange-rate observations
    Ingest->>Rates: Validate provider observations
    Rates-->>Ingest: Valid exchange rates or rejection
    break Invalid observation
        Ingest-->>Worker: Validation failure
    end
    Ingest->>Records: Request latest stored date for each observed pair
    Records-->>Ingest: Latest dates or no stored rate for each pair
    Note over Ingest,Records: Select observations at or after each latest date; include all for unseen pairs
    alt No selected observations
        Ingest-->>Worker: processedCount is zero
    else Observations selected
        Ingest->>Records: Save selected observations together, attributed to actor
        Records-->>Ingest: Rates committed
        Ingest-->>Worker: processedCount equals selected observation count
    end
```
