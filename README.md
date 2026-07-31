# ARISE

ARISE is a Next.js prototype backend for academic risk intelligence and student support workflows.

Sprint 1 is complete for the agreed prototype scope.

Sprint 2 implements Better Auth email/password access, registrar-provisioned accounts, Resend activation emails, student privacy-consent gating, and authenticated RBAC/RLS context.

## Local Setup

1. Install dependencies with `pnpm install`.
2. Create `.env` from `.env.example`, set `DATABASE_URL`, and provide a local `BETTER_AUTH_SECRET` with at least 32 characters.
3. Set `RESEND_API_KEY` and `AUTH_EMAIL_FROM` before testing email delivery.
4. Apply the schema with `pnpm db:migrate`.
5. Provision application roles with `pnpm db:provision`.
6. Load repeatable demo data with `pnpm db:seed`.
7. Start Next.js with `pnpm dev`.

Protected API routes resolve Better Auth session cookies and map the authenticated user to an active ARISE account. The development actor header is no longer accepted.

## Commands

- `pnpm dev`: start the development server.
- `pnpm test`: run the Vitest suite.
- `npx tsc --noEmit`: run the TypeScript check.
- `pnpm db:generate`: generate a Drizzle migration from schema changes.
- `pnpm db:check`: validate the Drizzle migration state.
- `pnpm db:migrate`: apply generated migrations.
- `pnpm db:provision`: grant application database roles.
- `pnpm db:seed`: seed stable demo users and academic data.
- `pnpm dlx auth@latest generate`: regenerate the Better Auth Drizzle schema after changing Better Auth plugins.

## Scope

Sprint 1 domain workflows remain available behind Better Auth sessions. Sprint 2 adds registrar provisioning, activation/reset and verification delivery, authenticated ARISE RBAC/RLS context, and student privacy-consent gating. See [`docs/api/sprint-1.md`](docs/api/sprint-1.md), [`docs/api/sprint-2-auth.md`](docs/api/sprint-2-auth.md), and [`docs/requirements.md`](docs/requirements.md).

See [`docs/plans/2026-07-30-sprint-2-auth.md`](docs/plans/2026-07-30-sprint-2-auth.md) for the next sprint's authentication and authorization plan.
