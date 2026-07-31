# Sprint 3 Intervention Workflow

**Status:** Planned. The implementation plan is [`../plans/2026-07-31-sprint-3-interventions.md`](../plans/2026-07-31-sprint-3-interventions.md).

## Scope

Sprint 3 is the smallest counselor intervention vertical slice:

- Faculty referral creation for students in an assigned section.
- Student support-signal conversion into an assigned counselor case.
- Counselor case list/detail, status transition, and intervention-note workflows.
- Faculty referral-status tracking.
- ARISE permission checks, RLS enforcement, and audit events for these mutations.

## Planned Endpoints

| Route | Method | Actor | Behavior |
| --- | --- | --- | --- |
| `/api/v1/faculty/sections/[sectionId]/referrals` | POST | Faculty | Refers an enrolled student and creates an assigned counselor case. |
| `/api/v1/faculty/referrals` | GET | Faculty | Lists only referrals created by the authenticated faculty member. |
| `/api/v1/counselor/cases` | GET | Counselor | Lists only cases assigned to the authenticated counselor. |
| `/api/v1/counselor/cases/[caseId]` | GET | Counselor | Returns one assigned case with immutable history. |
| `/api/v1/counselor/cases/[caseId]/status` | POST | Counselor | Appends an attributed status transition. |
| `/api/v1/counselor/cases/[caseId]/notes` | POST | Counselor | Appends an attributed intervention note. |

Existing `POST /api/v1/student/support-signals` will create the support signal and counselor case together.

## Security Boundary

The server resolves the faculty section, student enrollment, active counselor assignment, case owner, and note/status author from the authenticated ARISE actor. Requests cannot authorize with client-provided counselor, employee, student, case-owner, or database-role identifiers.

Faculty tracking returns only their own referral status. Intervention notes and unrelated case data remain counselor-only. Cases remain scoped to the active assigned counselor through ARISE permissions, fixed database roles, and PostgreSQL RLS.

## Deferred

Direct messaging, reminders, notifications, digest generation, external delivery providers, UI portals, integrations, reports, and analytics are not part of Sprint 3.
