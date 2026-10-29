# Reset Password

```mermaid
sequenceDiagram
    actor Caller
    participant Reset as Password Reset
    participant Tokens as Reset Tokens
    participant Accounts as User Accounts
    participant Credentials as Credential Preparation
    participant Sessions as Session Management
    participant Client as Client Session
    participant Events as Event Subscribers

    Caller->>Reset: Reset token, new password, and confirmation
    Reset->>Tokens: Claim reset token
    Tokens-->>Reset: Claimed user identity or rejection
    alt Claim rejected
        Reset-->>Caller: Token error
    else Token claimed
        Reset->>Accounts: Request user, actor, and authentication state
        Accounts-->>Reset: User state or error
        Reset->>Credentials: Prepare replacement password
        Credentials-->>Reset: Protected password credential
        Reset->>Sessions: Prepare new user session
        Sessions-->>Reset: Session and credentials
        Reset->>Accounts: Save password and replace all user sessions together
        Accounts-->>Reset: Committed changes or failure
        alt Preparation or save failed
            Reset->>Tokens: Release reset-token claim
            Tokens-->>Reset: Released or cleanup failure
            Note over Reset,Tokens: Cleanup failure is reported; original failure is retained
            Reset-->>Caller: Original failure
        else Changes committed
            Reset->>Tokens: Finalize reset-token consumption
            Tokens-->>Reset: Finalized or finalization failure
            Note over Reset,Tokens: Finalization failure is reported and processing continues
            Reset->>Client: Set new refresh token
            Reset->>Events: Password reset
            Reset-->>Caller: New access token
        end
    end
    Note over Reset,Caller: Later client or event failures propagate without undoing the reset
```
