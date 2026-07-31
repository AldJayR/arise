# Sprint 3 Intervention Workflow

**Status:** Implemented. The implementation boundary is [`../plans/2026-07-31-sprint-3-interventions.md`](../plans/2026-07-31-sprint-3-interventions.md).

## Scope

Sprint 3 is the smallest counselor intervention vertical slice:

- Faculty referral creation for an enrolled student in an assigned section.
- Student support-signal conversion into one assigned counselor case.
- Counselor case list/detail, status transition, and intervention-note workflows.
- Faculty referral-status tracking for referrals originated by the authenticated faculty member.
- ARISE permissions, PostgreSQL RLS enforcement, and audit events for these mutations.

## Endpoints

| Route | Method | Actor | Request | Result |
| --- | --- | --- | --- | --- |
| `/api/v1/faculty/sections/[sectionId]/referrals` | POST | Faculty | `{ studentId, contextualNote? }` | Creates a referral, assigned case, and pending state. |
| `/api/v1/faculty/referrals` | GET | Faculty | None | Lists only the faculty member's compact referral tracking data. |
| `/api/v1/counselor/cases` | GET | Counselor | Optional `?status=` | Lists assigned cases, optionally by `pending`, `contacted`, `responded`, or `resolved`. |
| `/api/v1/counselor/cases/[caseId]` | GET | Counselor | None | Returns one assigned case with ordered status and note history. |
| `/api/v1/counselor/cases/[caseId]/status` | POST | Counselor | `{ status }` | Appends an attributed case status row. |
| `/api/v1/counselor/cases/[caseId]/notes` | POST | Counselor | `{ note }` | Appends one attributed, non-blank intervention note. |
| `/api/v1/student/support-signals` | POST | Student | `{}` | Creates the support signal, assigned case, and pending state atomically. |

Request bodies are strict Zod objects. Referral context is trimmed and limited to 500 characters; intervention notes are trimmed and limited to 2,000 characters. Client requests cannot supply actor, counselor, case-owner, status-author, note-author, or database-role identities.

## Case And Status Model

`support_signals` and `counselor_referrals` are intake facts. Each valid intake creates one `services.cases` row with an immutable `source` and the server-resolved active counselor. The initial `pending` value is appended to `case_status_history`; current case status is always the latest history row and is never duplicated in the case table. Faculty referral tracking uses `referral_status_history` and maps `responded` to the compact `contacted` referral state.

## Security Boundary

The server derives the authenticated actor from Better Auth and opens one actor-scoped RLS transaction. Faculty referral creation verifies section assignment and active enrollment before resolving the student's active counselor. Student support signals use only the authenticated student's identity and require support consent. Counselors can list, inspect, transition, and annotate only cases assigned to their employee identity.

Faculty tracking includes student identity, section ID, referral time, and current referral state only. It omits counselor case contents and intervention notes. Every referral, case, status, and note mutation records an audit event. The fixed database role and RLS policies reject client-controlled authorization fields even if a route is bypassed.

Errors use the common contract:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You are not allowed to perform this action"
  }
}
```

Validation failures return `BAD_REQUEST`; missing resources return `NOT_FOUND`; missing role or permission returns `FORBIDDEN`; missing privacy consent returns `CONSENT_REQUIRED`.

## Deferred

Direct messaging, reminders, notifications, digest generation, external delivery providers, UI portals, integrations, reports, and analytics are intentionally deferred from Sprint 3.
