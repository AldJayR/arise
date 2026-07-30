# Sprint 2 Authentication

**Status:** Planned. No Better Auth endpoints or Resend integration are implemented yet.

The implementation plan is [`docs/plans/2026-07-30-sprint-2-auth.md`](../plans/2026-07-30-sprint-2-auth.md).

## Approved Flow

- Better Auth provides email/password authentication and secure sessions.
- Public sign-up is disabled.
- Registrar/SIS provisions an existing active ARISE identity using its institutional email.
- Better Auth creates the authentication identity and ARISE links it through `identity.user_accounts.authentication_subject`.
- Resend delivers a one-time activation/password-reset email.
- Students activate their accounts, verify their institutional email, sign in, and complete privacy consent before protected cross-departmental records are returned.
- ARISE roles and permissions remain the authorization source; Better Auth does not become a second RBAC system.

## Planned Endpoints

| Route | Purpose |
| --- | --- |
| `GET|POST /api/auth/[...all]` | Better Auth sign-in, sign-out, verification, reset, and session operations. |
| `POST /api/v1/registrar/auth-users` | Registrar/admin-only provisioning and ARISE role assignment. |
| `GET /api/v1/student/privacy-consent` | Read the current policy and authenticated student's consent state. |
| `POST /api/v1/student/privacy-consent` | Grant consent for the current policy using the authenticated student identity. |

## Security Boundary

Protected API routes will resolve the Better Auth session server-side, map the session user ID to an active ARISE account, then derive the person/student/employee identity and transaction-local RLS context. Client-provided student IDs, employee IDs, role codes, and counselor recipients will not authorize access.

The current Sprint 1 `x-arise-actor-id` header remains development-only until this plan is implemented. It is not a production authentication mechanism.
