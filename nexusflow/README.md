# NexusFlow

Multi-tenant, AI-assisted project management SaaS (modular monolith).
**Status: Phase 2 – authentication, multi-tenancy and RBAC.** Later phases add projects & tasks, real-time, jobs, analytics, AI, billing and the React frontend.

## Repository layout

```
apps/api/            Express + TypeScript + Mongoose API
  src/config/        env validation (Zod), logger (pino, with secret redaction)
  src/infra/         MongoDB and Redis connections + health probes
  src/middleware/    request id, centralized error handling
  src/shared/        AppError, response helpers, constants, schema helpers
  src/modules/       one folder per business module (models today; services/routes later)
  tests/             Vitest + Supertest
docs/er-diagram.md   Mermaid ER diagram + tenancy rules
docker-compose.yml   MongoDB (replica set, for transactions) + Redis [+ API under profile "full"]
```

## Requirements

Node.js >= 22, npm >= 10, Docker + Docker Compose.

## Getting started

```bash
cp .env.example .env            # then set real JWT secrets (see comments inside)
npm install
npm run infra:up                # MongoDB (replica set rs0) + Redis
npm run dev:api                 # http://localhost:4000
curl localhost:4000/health/ready
```

MongoDB runs as a single-node **replica set** because multi-document transactions require one.
When running the API on your host, the URI uses `directConnection=true` (see `.env.example`).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev:api` | API with hot reload (tsx) |
| `npm run typecheck` | TypeScript strict check |
| `npm test` | Vitest + Supertest. Uses an in-memory MongoDB replica set (first run downloads a `mongod` binary) |
| `npm run build` | Compile API to `apps/api/dist` |
| `docker compose --profile full up --build` | Run the API in a container too |

## Health endpoints

- `GET /health/live` – process liveness
- `GET /health/ready` – MongoDB + Redis reachability (`503` if degraded)

(also exposed under `/api/v1/health/*`)

## Conventions

- Response envelope: `{ success: true, data, meta? }` / `{ success: false, error: { code, message, details?, requestId } }`.
- Cross-tenant lookups return **404**, not 403, so resource IDs cannot be probed.
- Secrets are redacted from logs; env is validated at boot and the process refuses to start on bad config.

## Roadmap

1. ✅ Foundation
2. ✅ Auth, tenant context, permission-based RBAC, cross-tenant tests (this phase)
3. Projects, tasks, sprints, Kanban ordering
4. Real-time (Socket.IO), notifications, BullMQ jobs
5. Analytics, AI assistant, billing
6. React frontend

## API (Phase 2) – base path `/api/v1`

| Method | Path | Notes |
|---|---|---|
| POST | `/auth/register` | email, name, password (min 10 chars, letter + number) |
| POST | `/auth/login` | returns `accessToken` (15 min) + sets HttpOnly `nf_refresh` cookie |
| POST | `/auth/refresh` | rotates the refresh token; reuse of an old token revokes the whole session family |
| POST | `/auth/logout`, `/auth/logout-all` | revoke current / all sessions |
| POST | `/auth/verify-email` | one-time token from the email |
| POST | `/auth/forgot-password`, `/auth/reset-password` | generic response; reset revokes all sessions |
| GET | `/auth/me` | current user |
| POST / GET | `/workspaces` | create (transactional) / list mine |
| GET / PATCH / DELETE | `/workspaces/:workspaceId` | `workspace:view` / `workspace:manage` / `workspace:delete` (OWNER, name confirmation, 7-day soft delete) |
| GET | `/workspaces/:workspaceId/members` | paginated (`?page=&limit=`) |
| PATCH / DELETE | `/workspaces/:workspaceId/members/:userId` | change role / remove, with anti-escalation rules |

Send the access token as `Authorization: Bearer <token>`.

## Security decisions

- **Passwords:** Argon2id. Login timing is equalised for unknown emails; 5 failures lock the account for 15 minutes; auth endpoints are rate limited (20 / 15 min / IP).
- **Tokens:** short-lived JWT (HS256, algorithm pinned, issuer/audience checked) in memory on the client; refresh token is opaque, stored only as an HMAC hash, in an HttpOnly + SameSite=Strict cookie scoped to `/api/v1/auth`, with an Origin check on refresh/logout (CSRF).
- **Multi-tenancy:** `resolveTenant` is the only place a client-supplied `:workspaceId` becomes trusted, and only if the caller has a membership. Non-members get the same `404` as for non-existent ids.
- **RBAC:** permission-based (`src/modules/rbac/permissions.ts`), enforced server-side with `requirePermission(...)`.
- **Injection / mass assignment:** every body is a strict Zod schema; `z.string()` rejects `{ "$gt": "" }`-style operator objects.
- **Email:** `ConsoleMailer` is a placeholder; it does **not** send real email (dev prints links to the console). Real delivery arrives with BullMQ + SMTP in a later phase.
- **Known trade-off:** access tokens are stateless, so a revoked session's access token stays valid until it expires (max 15 min).

## Not in this phase yet

Invitations by email, project/task APIs, Swagger docs, billing limits.
