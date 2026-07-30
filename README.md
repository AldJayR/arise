# ARISE

ARISE is a Next.js prototype backend for academic risk intelligence and student support workflows.

Sprint 1 is complete for the agreed prototype scope.

## Local Setup

1. Install dependencies with `pnpm install`.
2. Create `.env` with `DATABASE_URL` pointing to a disposable PostgreSQL database.
3. Apply the schema with `pnpm db:migrate`.
4. Provision application roles with `pnpm db:provision`.
5. Load repeatable demo data with `pnpm db:seed`.
6. Start Next.js with `pnpm dev`.

The seed command prints development actor account IDs. Pass one ID in the `x-arise-actor-id` header when calling the Sprint 1 endpoints. This header is rejected when `NODE_ENV=production`; production authentication is intentionally deferred.

## Commands

- `pnpm dev`: start the development server.
- `pnpm test`: run the Vitest suite.
- `npx tsc --noEmit`: run the TypeScript check.
- `pnpm db:generate`: generate a Drizzle migration from schema changes.
- `pnpm db:check`: validate the Drizzle migration state.
- `pnpm db:migrate`: apply generated migrations.
- `pnpm db:provision`: grant application database roles.
- `pnpm db:seed`: seed stable demo users and academic data.

## Scope

Sprint 1 covers faculty attendance and grade writes, rule-based risk evaluation, the student dashboard, confidential support signals, and the counselor support queue. See [`docs/api/sprint-1.md`](docs/api/sprint-1.md) for the API contract and [`docs/requirements.md`](docs/requirements.md) for the approved requirements.
