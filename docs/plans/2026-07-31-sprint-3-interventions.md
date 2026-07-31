# Sprint 3 Intervention Workflow Implementation Plan

**Goal:** Complete the smallest secure intervention loop: faculty referrals and student support signals create counselor-owned cases, and assigned counselors can track status and record intervention notes.

**Architecture:** Keep route handlers as thin adapters over one cohesive `interventions` service. Reuse the existing normalized referral, support-signal, case, case-status-history, intervention-note, audit, authentication, authorization, and RLS infrastructure; add no workflow engine, event bus, queue, scheduler, or duplicate case tables. Each mutation runs in the authenticated actor's RLS transaction and derives student, section, counselor, and actor identities server-side.

**Tech Stack:** Next.js 16 App Router, Better Auth, Drizzle ORM, PostgreSQL RLS, TypeScript, Vitest, Zod 4.

---

## Sprint Boundary

### In Scope

- Faculty referral creation for a student enrolled in the faculty member's assigned section.
- Student support-signal conversion into an assigned counselor case.
- Counselor case list, case detail, status transition, and intervention-note workflows.
- Referral tracking data for the referring faculty member.
- Focused ARISE permissions, database grants, RLS write policies, audit events, seed data, API documentation, and tests needed by those workflows.

### Explicitly Deferred

- Direct messaging, warm-nudge templates, reminders, scheduled jobs, and notification delivery.
- Weekly risk digests and counselor analytics.
- Counselor search, consolidated student profiles, re-enrollment tracking, registrar workflows, dean analytics, reports, exports, and UI portals.
- Offline sync, QR attendance, CSV/XLSX imports, SIS/financial/SMS integrations, and generic workflow/notification frameworks.

## Approved Decisions

- One intervention service owns referrals, signal-to-case conversion, case reads, status changes, and notes.
- A case is created immediately when a valid support signal or faculty referral is created. Its source is immutable and its current state is derived from `services.case_status_history`.
- The active counselor assignment is resolved on the server at creation time. Clients never select a recipient counselor, case owner, student, status, or author.
- Faculty may read tracking details only for referrals they created; they do not receive counselor notes or unrelated case data.
- Counselors may operate only on cases assigned to their employee identity.
- Every Sprint 3 mutation records an audit event. Read auditing beyond existing requirements is deferred.
- Use only existing case-related tables. Generate a migration only if narrow RLS policies or grants require schema changes.

## Requirements Mapping

| Requirement | Sprint 3 response |
| --- | --- |
| `FAC-FR-007` | Faculty creates an assigned-section referral with an optional note. |
| `FAC-FR-008` | Deferred; requires an alert-suppression model not present in the current vertical slice. |
| `FAC-FR-011` | Faculty reads the status history for referrals they originated. |
| `STU-FR-007` | Existing support signal becomes an assigned counselor case. |
| `CNS-FR-004` | Assigned counselor writes attributed intervention notes. |
| `CNS-FR-005` | Assigned counselor lists cases and records state transitions. |
| `CNS-FR-009` | Assigned counselor's case list includes support-signal cases. |
| `NFR-SEC-002` | ARISE permissions plus role-specific RLS policies enforce each operation. |
| `NFR-SEC-004` | Referral, case, status, and note mutations create audit events. |
| `NFR-SEC-005` | Case access remains restricted to the student and assigned counselor; faculty gets only referral tracking. |

## API Contract

| Route | Method | Actor | Behavior |
| --- | --- | --- | --- |
| `/api/v1/faculty/sections/[sectionId]/referrals` | POST | Faculty | Creates a referral and assigned counselor case for an enrolled student. |
| `/api/v1/faculty/referrals` | GET | Faculty | Lists referrals originated by the authenticated faculty member with current status. |
| `/api/v1/counselor/cases` | GET | Counselor | Lists cases assigned to the authenticated counselor, optionally filtered by status. |
| `/api/v1/counselor/cases/[caseId]` | GET | Counselor | Returns one assigned case and its status/note history. |
| `/api/v1/counselor/cases/[caseId]/status` | POST | Counselor | Appends an allowed status transition. |
| `/api/v1/counselor/cases/[caseId]/notes` | POST | Counselor | Appends one non-empty intervention note. |
| Existing `/api/v1/student/support-signals` | POST | Student | Creates the support signal and its assigned counselor case atomically. |

All route bodies are strict Zod objects. Client-supplied student, employee, counselor, actor, case-owner, author, and database-role identifiers must be rejected.

## Task 1: Intervention Authorization And Write Policies

**Files:**
- Modify: `src/db/schema/services.ts`
- Modify: `src/db/schema/rls.ts` only if a reusable assignment predicate is necessary
- Modify: `src/db/provision.ts`
- Modify: `src/db/seed.ts`
- Create: generated migration under `drizzle/` only if schema declarations change
- Test: `tests/services/interventions.test.ts`

1. Add failing tests showing that faculty can create only referrals/cases tied to their own section, students can create only cases sourced from their own support signal, and counselors can mutate only their assigned cases.
2. Add only the RLS `INSERT`/`UPDATE` policies and PostgreSQL grants required by those tests. Keep `SELECT` policies unchanged unless a route demonstrably needs a missing read path.
3. Add narrowly named ARISE permissions: `faculty:referrals`, `faculty:referral-tracking`, `counselor:cases`, and `counselor:intervention-notes`.
4. Assign those permissions to the relevant seeded roles using the existing seed helpers; do not create a new authorization model.
5. Generate a Drizzle migration only if Step 2 changes the declared schema, then run `pnpm db:check`.

## Task 2: Referral And Case Service

**Files:**
- Create: `src/server/services/interventions.ts`
- Create: `src/server/validation/interventions.ts`
- Modify: `src/server/services/support.ts`
- Modify: `src/server/services/audit.ts` only if its existing input cannot represent one of these mutations
- Test: `tests/services/interventions.test.ts`

1. Write failing tests for a valid referral, an unassigned-section rejection, an enrollment-outside-section rejection, and no-active-counselor-assignment rejection.
2. Implement `createFacultyReferral` in `interventions.ts`. Verify faculty section ownership and student enrollment server-side, resolve the active counselor assignment, insert `counselor_referrals`, insert the case with `source: "faculty_referral"`, append its initial `pending` status, and audit the operation in one transaction.
3. Write a failing test that a valid support signal creates exactly one support-signal case and repeated creation cannot create duplicate cases for one signal.
4. Refactor `createSupportSignal` only enough to insert the signal, its case, and the initial pending status atomically. Reuse the same internal case-creation helper; do not introduce a generic workflow abstraction.
5. Keep optional referral context limited to a trimmed non-empty-or-null string with a small explicit maximum length. Do not add rich text, attachments, categories, or arbitrary metadata.

## Task 3: Faculty Referral Tracking

**Files:**
- Create: `src/app/api/v1/faculty/sections/[sectionId]/referrals/route.ts`
- Create: `src/app/api/v1/faculty/referrals/route.ts`
- Modify: `src/server/services/interventions.ts`
- Test: `tests/services/interventions.test.ts`
- Modify: `docs/api/sprint-3-interventions.md`

1. Write failing validation tests for a strict referral body containing only `studentId` and optional `contextualNote`.
2. Implement the referral `POST` route as a thin adapter: validate `sectionId` and JSON input, open `withActorTransaction`, require the faculty role and `faculty:referrals`, and call the service.
3. Implement `listFacultyReferrals` to return only referrals where `referredByEmployeeId` is the authenticated employee. Include compact student identity, section ID, referral timestamp, and latest case/referral state; omit intervention notes and counselor-only data.
4. Add the faculty tracking `GET` route with role and `faculty:referral-tracking` checks.
5. Test that a different faculty member cannot create or list another faculty member's referral data.

## Task 4: Counselor Case Operations

**Files:**
- Create: `src/app/api/v1/counselor/cases/route.ts`
- Create: `src/app/api/v1/counselor/cases/[caseId]/route.ts`
- Create: `src/app/api/v1/counselor/cases/[caseId]/status/route.ts`
- Create: `src/app/api/v1/counselor/cases/[caseId]/notes/route.ts`
- Modify: `src/server/services/interventions.ts`
- Modify: `src/server/validation/interventions.ts`
- Test: `tests/services/interventions.test.ts`

1. Write failing tests for counselor assignment isolation, the initial pending case state, allowed state values, and rejection of blank intervention notes.
2. Implement `listCounselorCases` with one optional status filter. Return a compact case DTO: case ID, source, student identity needed by the assigned counselor, opened time, and latest status. Do not add generic filtering, pagination, or search until an actual UI contract requires it.
3. Implement `getCounselorCase` with only the assigned case, ordered status history, and ordered intervention notes.
4. Implement `appendCaseStatus` to append one `pending`, `contacted`, `responded`, or `resolved` history row attributed to the authenticated counselor. Preserve immutable history; do not add a duplicated current-status column.
5. Implement `addInterventionNote` to insert one attributed, non-empty note for an assigned case.
6. Audit each counselor mutation and verify a non-assigned counselor receives a controlled `403` or `404` without another counselor's case contents.

## Task 5: Documentation And Verification

**Files:**
- Create: `docs/api/sprint-3-interventions.md`
- Modify: `README.md`
- Modify: `docs/database-design.md`
- Modify: `docs/requirements.md` only if traceability clarification is necessary

1. Document the planned/implemented endpoints, strict request bodies, actor permissions, error contract, case-source model, and confidentiality boundary.
2. State that direct messaging, reminders, notifications, digests, UI, integrations, and analytics are intentionally deferred from Sprint 3.
3. Update the README Sprint 3 scope and link this plan/API contract.
4. Run `pnpm test`, `npx tsc --noEmit`, targeted Biome checks for touched files, and `pnpm db:check`.
5. Run `pnpm db:migrate`, `pnpm db:provision`, and `pnpm db:seed` against a disposable local database only if a migration or database grants changed.

## Sprint 3 Acceptance Criteria

- A faculty member can refer only a student enrolled in their assigned section.
- A valid faculty referral creates one assigned counselor case with an initial pending status.
- A valid student support signal creates one assigned counselor case atomically.
- A counselor can list, inspect, transition, and add notes only to cases assigned to that counselor.
- A referring faculty member can view compact status tracking for only their own referrals, without counselor notes.
- Client-controlled identities, counselors, case ownership, status authors, and database roles never authorize operations.
- Referral, case, status, and note mutations create audit events.
- No new tables, messaging, reminders, notifications, scheduled jobs, generic workflow framework, portal UI, or external integration is introduced.
