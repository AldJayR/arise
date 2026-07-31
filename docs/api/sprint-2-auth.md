# Sprint 2 Authentication

**Status:** Backend authentication and authorization implemented; activation UI is outside Sprint 2.

The implementation follows [`../plans/2026-07-30-sprint-2-auth.md`](../plans/2026-07-30-sprint-2-auth.md).

## Authentication Boundary

- Better Auth owns email/password credentials, sessions, email verification, password reset, and authentication lifecycle tables.
- ARISE owns persons, students, employees, active/locked/disabled account state, roles, permissions, consent, audit identity, and RLS context.
- `session.user.id` maps to `identity.user_accounts.authentication_subject` as an opaque string.
- Better Auth Admin metadata is used only for the server-side user-lifecycle API; ARISE permissions authorize the registrar route and all domain operations.
- Public email/password signup is disabled.
- Production may use `AUTH_DATABASE_URL` for a separate least-privileged Better Auth database connection; local development falls back to `DATABASE_URL`.

## Better Auth Endpoints

`GET|POST /api/auth/[...all]` handles Better Auth sign-in, sign-out, email verification, password reset, and session operations.

Protected ARISE routes require the Better Auth session cookie. Missing, expired, unverified, disabled, unlinked, or inactive identities receive controlled `401` responses.

## Registrar Provisioning

`POST /api/v1/registrar/auth-users` requires the ARISE `auth:provision` permission. The request identifies an existing identity using one institutional student or employee number and a server-allowlisted role profile:

```json
{
  "employeeNumber": "EMP-001",
  "roleProfile": "faculty"
}
```

The service resolves the institutional email and ARISE role ID server-side. It does not accept destination emails, Better Auth roles, database roles, account IDs, student IDs, or counselor recipients. A Better Auth user is created with an unusable random password, linked to `identity.user_accounts.authentication_subject`, and assigned the ARISE role before activation delivery starts.

The service then starts password-reset and email-verification delivery through Resend. Passwords, tokens, and full URLs are never logged. Re-provisioning an active link returns `409 CONFLICT`.

## Student Privacy Consent

`GET /api/v1/student/privacy-consent` returns the current effective policy and the authenticated student's consent state.

`POST /api/v1/student/privacy-consent` accepts `{}` only. It grants the current policy's `cross_departmental_records` and `confidential_support_signal` purposes idempotently. Student identity and policy are resolved server-side.

Student dashboard data is blocked until `cross_departmental_records` consent exists. Support-signal creation is blocked until `confidential_support_signal` consent exists. The stable `CONSENT_REQUIRED` response includes policy metadata but no protected academic records.

## RLS Context

Each protected request validates the Better Auth session, performs an auth bootstrap lookup, maps ARISE roles to a fixed server-owned PostgreSQL role, and sets transaction-local identity values before domain queries. Request values are never interpolated into `SET ROLE` and client-supplied identity fields never authorize access.
