# NexusFlow – Data Model

```mermaid
erDiagram
    USER ||--o{ MEMBERSHIP : "belongs to workspaces via"
    WORKSPACE ||--o{ MEMBERSHIP : has
    USER ||--o{ REFRESH_TOKEN : owns
    WORKSPACE ||--o{ INVITATION : issues
    WORKSPACE ||--o{ PROJECT : contains
    WORKSPACE ||--|| SUBSCRIPTION : "billed by"
    PLAN ||--o{ SUBSCRIPTION : defines
    PROJECT ||--o{ TASK : contains
    PROJECT ||--o{ SPRINT : plans
    SPRINT ||--o{ TASK : groups
    TASK ||--o{ TASK : "subtasks (parentTaskId)"
    TASK }o--o{ TASK : "dependsOn"
    TASK ||--o{ COMMENT : has
    TASK }o--o{ USER : "assigneeIds"
    WORKSPACE ||--o{ CONVERSATION : hosts
    CONVERSATION ||--o{ MESSAGE : contains
    USER ||--o{ NOTIFICATION : receives
    WORKSPACE ||--o{ ACTIVITY_LOG : audits
    WORKSPACE ||--o{ ATTACHMENT : stores
    TASK ||--o{ ATTACHMENT : "has files"
    MESSAGE ||--o{ ATTACHMENT : "has files"

    USER { string email UK
           string passwordHash
           date emailVerifiedAt }
    WORKSPACE { string slug UK
                ObjectId ownerId
                date deletedAt }
    MEMBERSHIP { ObjectId workspaceId
                 ObjectId userId
                 string role "OWNER|ADMIN|MANAGER|MEMBER|VIEWER" }
    PROJECT { ObjectId workspaceId
              string key "unique per workspace"
              string status
              int taskCounter }
    TASK { ObjectId workspaceId
           ObjectId projectId
           int number
           string status
           string priority
           double position "fractional index" }
    SPRINT { ObjectId workspaceId
             date startDate
             date endDate }
    SUBSCRIPTION { ObjectId workspaceId UK
                   string planTier
                   string status }
    REFRESH_TOKEN { string tokenHash UK
                    string familyId
                    date expiresAt "TTL" }
```

## Tenancy rules

- Every collection except `users`, `workspaces`, `plans`, `refreshTokens` carries a **required** `workspaceId`
  and at least one index that **starts with** `workspaceId`. This is enforced by `tests/tenancy.schema.test.ts`.
- `memberships` is the single source of truth for access; the tenant-context middleware (next phase) resolves
  the workspace from the URL and verifies membership server-side on every request.
