# Sprint 1 API

**Status:** Complete for the agreed prototype scope.

Verified during Sprint 1: `pnpm test`, `npx tsc --noEmit`, targeted Biome checks, `pnpm db:check`, `pnpm db:migrate`, `pnpm db:provision`, and repeatable `pnpm db:seed`.

Per the agreed acceptance scope, integration tests and `pnpm build` are not required for Sprint 1 completion.

## Development Authentication

Every endpoint requires the account UUID printed by `pnpm db:seed`:

```http
x-arise-actor-id: <user-account-uuid>
```

The development actor resolver loads the account, person, student/employee identity, active status, and assigned roles server-side. Client-provided student or employee IDs are not used for authorization. The header is rejected in production.

## Error Contract

Errors use this shape and never expose database errors:

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Request validation failed",
    "details": [{ "path": ["entries"], "message": "Invalid input" }]
  }
}
```

`400` means malformed input, `401` means missing or invalid actor, `403` means role or ownership failure, `404` means the resource is absent, `409` means a duplicate, locked, or otherwise conflicting state, and `500` means an unexpected server failure.

## Faculty Sections

`GET /api/v1/faculty/sections` lists sections assigned to the current faculty employee.

`GET /api/v1/faculty/sections/{sectionId}/roster` returns the assigned section, attendance policy, roster, and compact current risk summary.

`POST /api/v1/faculty/sections/{sectionId}/sessions` creates a class session:

```json
{
  "sessionSequence": 1,
  "startsAt": "2026-07-30T08:00:00Z",
  "endsAt": "2026-07-30T09:30:00Z",
  "type": "lecture"
}
```

`PUT /api/v1/faculty/sections/{sectionId}/attendance` replaces one session's submitted roster atomically:

```json
{
  "sessionId": "<session-uuid>",
  "entries": [
    { "enrollmentId": "<enrollment-uuid>", "status": "present" },
    { "enrollmentId": "<enrollment-uuid>", "status": "absent" }
  ]
}
```

`PUT /api/v1/faculty/sections/{sectionId}/grades` upserts one grading period:

```json
{
  "gradePeriodId": "<grade-period-uuid>",
  "entries": [
    { "enrollmentId": "<enrollment-uuid>", "markKind": "numeric", "numericValue": 2.25 },
    { "enrollmentId": "<enrollment-uuid>", "markKind": "inc" },
    { "enrollmentId": "<enrollment-uuid>", "markKind": "drp" },
    { "enrollmentId": "<enrollment-uuid>", "markKind": "pass" },
    { "enrollmentId": "<enrollment-uuid>", "markKind": "fail" }
  ]
}
```

Numeric marks must be between `1.00` and `5.00`. Each enrollment may occur once per request. Attendance and grade writes verify section ownership, write audit events, and re-evaluate affected students in the same transaction.

## Student Dashboard

`GET /api/v1/student/dashboard` returns the current student's risk status, subjects, attendance history and usage, current grades and trend, and active counselor contact. The actor's student identity is the only student filter.

`POST /api/v1/student/support-signals` creates a confidential signal for the student's active assigned counselor. The Sprint 1 payload is an empty object because the workflow intentionally requires no explanation:

```json
{}
```

The request requires current `confidential_support_signal` consent and an active counselor assignment.

## Counselor Queue

`GET /api/v1/counselor/support-signals` returns pending and acknowledged signals addressed to the current counselor employee. The query does not accept a counselor ID and cannot return another counselor's queue.

## Requirement Mapping

| Requirement | Sprint 1 endpoint or service |
| --- | --- |
| `STU-FR-001`, `STU-FR-002`, `STU-FR-004`, `STU-FR-005` | Student dashboard read model |
| `STU-FR-007`, `STU-FR-011` | Student support signal route and consent check |
| `FAC-FR-001`, `FAC-FR-005`, `FAC-FR-009` | Faculty attendance/grade routes and risk service |
| `CNS-FR-009` | Counselor support signal queue |
| Attendance warning/critical, numeric decline, DRP, cross-subject | `src/server/services/risk.ts` |

## Deferred

Production authentication, OAuth, external integrations, notifications, QR check-in, offline client queues, imports/exports, messaging, registrar/dean portals, scheduled jobs, and UI implementation remain outside Sprint 1.
