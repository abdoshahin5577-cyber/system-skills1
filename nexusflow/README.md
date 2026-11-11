# NexusFlow

Multi-tenant, AI-assisted project management SaaS (modular monolith).
**Status: Phase 1 – foundation.** Later phases add auth, tenancy/RBAC, projects & tasks, real-time, jobs, analytics, AI, billing and the React frontend.

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
| `npm test` | Vitest suite (no DB/Redis needed in this phase) |
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

1. ✅ Foundation (this phase)
2. Auth, tenant context, permission-based RBAC, cross-tenant tests
3. Projects, tasks, sprints, Kanban ordering
4. Real-time (Socket.IO), notifications, BullMQ jobs
5. Analytics, AI assistant, billing
6. React frontend
