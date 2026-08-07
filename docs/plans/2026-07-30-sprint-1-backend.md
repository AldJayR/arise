# Sprint 1 Backend Implementation Plan

**Status:** Historical prototype milestone; not a full verification report.

The implementation covers the backend foundations, development seed, faculty academic workflows, rule-based risk evaluation, student dashboard, confidential support signals, counselor queue, auditing, and API documentation. The original milestone excluded integration tests and `pnpm build`; those exclusions must not be read as evidence that the complete repository is verified.

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Deliver a two-week prototype backend vertical slice for Faculty attendance and grades, rule-based student risk status, Student dashboard data, confidential support signals, and a Counselor support queue.

**Architecture:** Next.js route handlers are thin HTTP adapters. Each route resolves a development-only actor, opens a transaction with the existing RLS context, validates input, and calls a cohesive domain service. Domain services own business rules and Drizzle queries; shared request/response and database helpers remain small and are reused rather than duplicating SQL or authorization logic across routes.

**Tech Stack:** Next.js 16 App Router route handlers, TypeScript, Drizzle ORM 1.0.0-rc.4, PostgreSQL, Vitest, Zod.

---

## Sprint Boundary

### In Scope

- Development-only actor resolution and RLS transaction context.
- Repeatable demo seed data for one faculty member, one counselor, a small student cohort, one active term, course sections, enrollments, attendance policy, and grade periods.
- Faculty section roster read, class-session creation, bulk attendance submission, and grade entry.
- Pure, configurable rule-based risk evaluation after attendance or grade changes.
- Student dashboard read model: status, enrolled subjects, attendance usage, grade trend, and assigned counselor contact data.
- Student support signal creation and assigned-counselor queue read.
- Audit event writes for the Sprint 1 mutating workflows.
- Unit tests for rules/validation and integration tests for services using a development database.

### Explicitly Deferred

- Production authentication, OAuth, real session management, external SIS/financial/SMS integrations, notifications, QR check-in, client offline queue, CSV import/export, direct messaging, registrar administration, dean analytics, report generation, scheduled jobs, and UI implementation.

## Design Rules

- Keep routes as adapters only: no direct multi-table business logic in `route.ts` files.
- Keep one service per cohesive workflow domain, not one service per table.
- Use the existing normalized schema; add columns/tables only when a Sprint 1 behavior cannot be represented.
- Use Drizzle SQL builders and parameter binding; do not assemble SQL strings from request input.
- Validate every route payload with Zod at the boundary.
- Resolve actor identity server-side. The development adapter may honor `x-arise-actor-id` only when `NODE_ENV !== "production"`; production must reject it.
- Call `withRlsContext` for every database request. Actor context is derived from the resolved account, not accepted as arbitrary student/employee IDs.
- Return stable DTOs, not raw Drizzle table records.
- Re-evaluate risk in the same transaction as attendance/grade writes so reads never see stale Sprint 1 risk data.
- Do not introduce `relations.ts` in Sprint 1. Foreign keys already enforce integrity, and no nested Drizzle relational-query API is required.

## API Contract

| Route | Method | Actor | Behavior |
| --- | --- | --- | --- |
| `/api/v1/faculty/sections` | GET | Faculty | Lists sections assigned to the current employee. |
| `/api/v1/faculty/sections/[sectionId]/roster` | GET | Faculty | Returns enrolled students, risk summary, and attendance policy. |
| `/api/v1/faculty/sections/[sectionId]/sessions` | POST | Faculty | Creates a class session for an assigned section. |
| `/api/v1/faculty/sections/[sectionId]/attendance` | PUT | Faculty | Replaces one session's roster attendance atomically and evaluates affected students. |
| `/api/v1/faculty/sections/[sectionId]/grades` | PUT | Faculty | Upserts one period's marks atomically and evaluates affected students. |
| `/api/v1/student/dashboard` | GET | Student | Returns status, subjects, attendance, grades, and counselor details. |
| `/api/v1/student/support-signals` | POST | Student | Creates a confidential support signal addressed to the active assigned counselor. |
| `/api/v1/counselor/support-signals` | GET | Counselor | Returns pending/acknowledged signals assigned to the current counselor. |

Every write returns the updated resource or an explicit domain error. Use `400` for invalid input, `401` for missing development actor, `403` for role/ownership failures, `404` for absent resources, and `409` for duplicate/locked state conflicts. Do not expose database errors directly.

## Module Layout

```text
src/
  app/api/v1/
    faculty/sections/route.ts
    faculty/sections/[sectionId]/roster/route.ts
    faculty/sections/[sectionId]/sessions/route.ts
    faculty/sections/[sectionId]/attendance/route.ts
    faculty/sections/[sectionId]/grades/route.ts
    student/dashboard/route.ts
    student/support-signals/route.ts
    counselor/support-signals/route.ts
  server/
    auth/actor.ts
    http/errors.ts
    http/response.ts
    validation/faculty.ts
    validation/student.ts
    services/academic.ts
    services/risk.ts
    services/student.ts
    services/support.ts
    services/audit.ts
  db/
    client.ts
    seed.ts
    schema/
tests/
  setup.ts
  services/risk.test.ts
  services/academic.test.ts
  services/support.test.ts
```

`academic.ts` owns section, roster, attendance, and grade workflows. `risk.ts` is a pure evaluator plus persistence adapter. `student.ts` creates the dashboard DTO. `support.ts` owns signal creation/queue queries. `audit.ts` centralizes the one audit insert shape. These modules depend on `db` abstractions and DTOs, never on route handler objects.

## Task 1: Backend Foundations

**Files:**
- Create: `src/server/auth/actor.ts`
- Create: `src/server/http/errors.ts`
- Create: `src/server/http/response.ts`
- Create: `src/server/validation/faculty.ts`
- Create: `src/server/validation/student.ts`
- Create: `tests/setup.ts`
- Modify: `src/db/client.ts`
- Modify: `package.json`

1. Add `zod` and configure Vitest with a `test` script and a test setup file.
2. Create a development-only actor resolver. It reads `x-arise-actor-id`, loads the account/person/student/employee identity from the database, builds `RlsContext`, and rejects request headers in production.
3. Extend `withRlsContext` usage through a single `withActorTransaction(request, work)` helper so routes cannot omit RLS context accidentally.
4. Define `AppError`, `forbidden`, `notFound`, `conflict`, and one route error serializer. Do not make a generic repository or controller framework.
5. Write Zod schemas for UUID route params, session creation, bulk attendance entries, grade entries, and support-signal input.
6. Verify the actor resolver rejects absent/invalid actors and validation rejects malformed payloads.

## Task 2: Seed Development Data

**Files:**
- Create: `src/db/seed.ts`
- Modify: `package.json`
- Test: `tests/services/academic.test.ts`

1. Add `db:seed` using `tsx src/db/seed.ts`.
2. Seed only stable demo data: roles, permissions, users, one faculty employee, one counselor employee, four students, one current term, two courses/sections, attendance policies, grade periods, enrollments, and counselor assignments.
3. Use `onConflictDoNothing`/upsert patterns keyed by existing immutable codes so repeated seed runs are safe.
4. Print the generated demo actor IDs once, without logging database URLs or other secrets.
5. Verify a second seed run produces no duplicate business keys.

## Task 3: Faculty Academic Workflows

**Files:**
- Create: `src/server/services/academic.ts`
- Create: `src/app/api/v1/faculty/sections/route.ts`
- Create: `src/app/api/v1/faculty/sections/[sectionId]/roster/route.ts`
- Create: `src/app/api/v1/faculty/sections/[sectionId]/sessions/route.ts`
- Create: `src/app/api/v1/faculty/sections/[sectionId]/attendance/route.ts`
- Create: `src/app/api/v1/faculty/sections/[sectionId]/grades/route.ts`
- Test: `tests/services/academic.test.ts`

1. Implement `listFacultySections`, `getFacultyRoster`, `createClassSession`, `recordAttendance`, and `recordGrades` in one academic service module.
2. Confirm section ownership through `section_instructors` before every faculty operation; do not rely on client-supplied employee IDs.
3. Make attendance replacement atomic: verify all enrollment IDs belong to the section, reject duplicates, then upsert records by `(session_id, enrollment_id)`.
4. Make grade entry atomic: validate the grading period, validate the PH 1.0-5.0/INC/DRP/P-F constraints, then upsert by `(enrollment_id, grade_period_id)`.
5. Return faculty DTOs containing only roster fields needed by Sprint 1, including a compact risk summary.
6. Add focused service tests for ownership rejection, invalid enrollment/session combinations, duplicate entries, attendance upsert, and non-numeric mark validation.

## Task 4: Rule-Based Risk Engine

**Files:**
- Create: `src/server/services/risk.ts`
- Test: `tests/services/risk.test.ts`
- Modify: `src/server/services/academic.ts`

1. Implement a pure `evaluateSubjectRisk` function with explicit input/output types. It evaluates attendance warning (>=75%), attendance critical (100%), numeric midterm decline, and DRP.
2. Implement `evaluateStudentRisk` to combine subject evaluations and add the cross-subject condition when two or more subjects are amber/red.
3. Load active rule versions from `risk_rule_versions`; use the existing default values only when the development seed explicitly creates them.
4. Persist one `risk_evaluation` plus only currently triggered `risk_signals` after each attendance or grade transaction. Do not build an asynchronous queue in Sprint 1.
5. Test threshold boundaries, PH grade directionality (larger is worse), DRP, and cross-subject outcomes.

## Task 5: Student Dashboard And Support Signals

**Files:**
- Create: `src/server/services/student.ts`
- Create: `src/server/services/support.ts`
- Create: `src/server/services/audit.ts`
- Create: `src/app/api/v1/student/dashboard/route.ts`
- Create: `src/app/api/v1/student/support-signals/route.ts`
- Create: `src/app/api/v1/counselor/support-signals/route.ts`
- Test: `tests/services/support.test.ts`

1. Build the student dashboard DTO from normalized records: current risk severity, subject absence counts/remaining allowance, grade periods/trend, and current counselor contact data.
2. Avoid storing dashboard summaries. Calculate them in the service query and keep the query limited to the current student.
3. Create support signals only when the student has current consent for confidential support signaling. Resolve the current counselor assignment server-side.
4. Implement the counselor queue filtered by the current counselor and signal status. Do not expose it to faculty or other counselors.
5. Record an audit event for attendance writes, grade writes, and support-signal submission via the shared audit service.
6. Test consent enforcement, assigned-counselor routing, counselor isolation, and student dashboard data isolation.

## Task 6: Contract Verification And Documentation

**Files:**
- Create: `docs/api/sprint-1.md`
- Modify: `README.md`
- Modify: `docs/database-design.md`

1. Document request/response examples, development actor header usage, expected error codes, and required local commands.
2. Add a requirement-to-endpoint mapping for the Sprint 1 requirements: STU-FR-001/002/004/005/007/011, FAC-FR-001/005/007/009, CNS-FR-009, and the applicable risk rules.
3. Run `pnpm db:migrate`, `pnpm db:provision`, and `pnpm db:seed` against a disposable development database.
4. Run `pnpm test`, `npx tsc --noEmit`, `pnpm db:check`, and `pnpm build`.
5. Fix only Sprint 1 failures; do not broaden scope to deferred portals/features.

## Sprint Acceptance Criteria

- A seeded faculty actor can list assigned sections, create a session, submit a complete roster's attendance, and save a grading period.
- Attendance/grade writes update rule-based risk records in the same transaction.
- A seeded student actor can read only their dashboard and create one confidential support signal when consent exists.
- The assigned counselor can view that signal; another counselor cannot.
- Invalid actor identity, invalid UUIDs, malformed input, unassigned sections, and cross-section enrollment IDs receive controlled HTTP errors.
- No raw database rows or internal errors are sent to clients.
- No extra schema abstraction, generic CRUD endpoint, `relations.ts`, job queue, or client offline implementation is introduced.
