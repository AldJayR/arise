# Sprint 4 Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the smallest secure frontend for Better Auth sign-in/activation and the implemented student, faculty, and counselor workflows.

**Architecture:** Use standard Next.js App Router nested routes with route groups, not parallel routes. `(public)` owns unauthenticated pages, `(portal)` owns the shared authenticated shell, and explicit `/student`, `/faculty`, and `/counselor` routes own role-specific screens. Client-side session state and React Query drive the interactive portal, while API authorization and PostgreSQL RLS remain the only security boundary.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 7, Better Auth React client, TanStack Query, Tailwind CSS 4, existing Base UI/shadcn primitives, Lucide icons, Sonner, Vitest, Biome.

---

## Sprint Boundary

### In Scope

- Better Auth sign-in, sign-out, password activation/reset, and verification feedback.
- Authenticated role routing for student, faculty, and counselor users.
- Student dashboard, consent gate, and confidential support-signal action.
- Faculty section list, roster, class-session creation/selection, attendance capture, referral creation, and referral tracking.
- Counselor assigned-case list, status filtering, case detail, status transitions, and intervention notes.
- Responsive shared shell, loading/empty/error states, keyboard accessibility, and focused component/API tests.
- Only the narrow backend reads required by the frontend: safe authenticated actor profile and faculty session listing.

### Explicitly Deferred

- Registrar account-provisioning UI.
- Faculty grade entry until a read contract exposes existing grade periods and records.
- Direct messaging, warm nudges, reminders, notifications, scheduled jobs, analytics, reports, exports, search, offline sync, and integrations.
- Parallel routes, intercepting routes, catch-all routes, generic portal frameworks, client-side authorization models, and local-storage session state.

## Routing Decision

Use route groups and ordinary nested routes:

```text
src/app/
  (public)/
    layout.tsx
    page.tsx
    sign-in/page.tsx
    activate/page.tsx
    reset-password/page.tsx
    verify-email/page.tsx
  (portal)/
    layout.tsx
    student/page.tsx
    faculty/page.tsx
    faculty/sections/[sectionId]/page.tsx
    faculty/referrals/page.tsx
    counselor/page.tsx
    counselor/cases/[caseId]/page.tsx
```

Route groups preserve the public URLs while separating layouts. Dynamic segments represent API resource identifiers already used by the backend. Parallel routes are intentionally deferred because no current screen requires independently addressable sibling regions. If the counselor desktop workspace later needs a persistent list beside a selected case, preserve `/counselor/cases/[caseId]` as the canonical URL before considering a parallel-route composition.

## Security Contract

- Better Auth secure cookies remain the session authority.
- The browser never stores session tokens, ARISE roles, counselor IDs, employee IDs, student IDs for authorization, or database-role values in local storage.
- `/api/v1/me` is a convenience/read-model endpoint only. It controls navigation UX, not authorization.
- Every API request continues to derive actor, role, ownership, counselor assignment, and RLS context on the server.
- Redirect targets are accepted only when they are same-origin relative paths in an explicit allowlist.
- Client forms send only fields already accepted by the API contracts. They never send actor, author, owner, counselor, or database-role fields.
- Error rendering uses the common error envelope and does not display raw server/database errors.
- Sensitive student/counselor content is never placed in URL query parameters, browser storage, or analytics payloads.

## Task 1: Add Frontend Read Contracts

**Files:**

- Create: `src/server/services/profile.ts`
- Create: `src/app/api/v1/me/route.ts`
- Modify: `src/server/auth/actor.ts`
- Modify: `src/server/services/academic.ts`
- Modify: `src/app/api/v1/faculty/sections/[sectionId]/sessions/route.ts`
- Test: `tests/server/profile.test.ts`
- Test: `tests/services/academic.test.ts`

### Steps

1. Write tests for the safe actor profile DTO. It may expose display name, institutional email when available, and ARISE roles; it must omit database role, permissions not needed by the UI, raw account identifiers, and authentication subjects.
2. Extend the server-owned actor projection only enough to produce the profile DTO. Do not expose Better Auth or PostgreSQL identity values.
3. Implement `getAuthenticatedProfile` in `profile.ts` and the thin `GET /api/v1/me` route through `withActorTransaction`.
4. Write tests for faculty session listing scoped to an assigned section.
5. Implement `listClassSessions` in `academic.ts`, reusing `getOwnedSection`, with ordered session DTOs containing only session ID, sequence, times, and type.
6. Add `GET` beside the existing faculty session `POST` route. Keep the route adapter limited to parameter validation, role checking, transaction setup, and service invocation.
7. Run the targeted profile/academic tests, then `npx tsc --noEmit`.

## Task 2: Add Browser Auth And API Clients

**Files:**

- Create: `src/lib/auth-client.ts`
- Create: `src/lib/api/client.ts`
- Create: `src/lib/api/types.ts`
- Create: `src/lib/navigation.ts`
- Create: `src/components/providers/query-provider.tsx`
- Create: `src/components/providers/app-providers.tsx`
- Test: `tests/client/api-client.test.ts`
- Test: `tests/client/navigation.test.ts`

### Steps

1. Write API-client tests for credentials-included requests, JSON success parsing, the shared error envelope, malformed responses, `401`, `403`, `404`, and `CONSENT_REQUIRED` handling.
2. Implement `auth-client.ts` with Better Auth `createAuthClient` using the same-origin auth route. Export the supported session, email sign-in, sign-out, password-reset, and verification operations without wrapping them in a second auth abstraction.
3. Implement a small typed `apiFetch` helper. Default to same-origin relative URLs and `credentials: "include"`; allow only explicit HTTP methods and JSON bodies required by Sprint 4.
4. Define response types for `/api/v1/me`, student dashboard/consent, faculty sections/roster/sessions/referrals, and counselor cases. Keep these DTO types in the client layer rather than importing Drizzle/server types into browser bundles.
5. Implement same-origin redirect validation in `navigation.ts`. Invalid, absolute, protocol-relative, and off-origin destinations must fall back to the appropriate portal route.
6. Add a single TanStack Query provider with stable defaults for stale time, retry behavior, and mutation handling. Do not add global cache persistence or optimistic updates.
7. Run client unit tests, Biome, and TypeScript.

## Task 3: Build Public Auth Routes

**Files:**

- Move: `src/app/page.tsx` to `src/app/(public)/page.tsx`
- Create: `src/app/(public)/layout.tsx`
- Create: `src/app/(public)/sign-in/page.tsx`
- Create: `src/app/(public)/activate/page.tsx`
- Create: `src/app/(public)/reset-password/page.tsx`
- Create: `src/app/(public)/verify-email/page.tsx`
- Create: `src/components/auth/sign-in-form.tsx`
- Create: `src/components/auth/password-form.tsx`
- Create: `src/components/auth/verification-status.tsx`
- Create: `src/components/auth/session-router.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/components/auth.test.tsx`

### Steps

1. Write component tests for invalid email/password input, pending submission, controlled Better Auth errors, safe redirect handling, and successful session routing.
2. Replace the starter home screen with a compact ARISE entry page containing a clear sign-in action and no protected data.
3. Implement `SignInForm` with accessible labels, field-level validation, pending state, verification-required feedback, and safe return-path handling.
4. Implement one reusable password form for activation and reset flows. Read only the token needed by the Better Auth reset contract from the URL; never persist it or log it.
5. Implement verification feedback for success, expired/invalid links, and resend guidance using Better Auth’s supported client operation.
6. Implement `SessionRouter` using Better Auth session state plus `/api/v1/me`. Route only to explicit student, faculty, or counselor paths. Render a controlled unsupported-role state rather than guessing.
7. Add the shared `AppProviders` and one root `Toaster`. Preserve server-rendered metadata and avoid adding a theme provider until a real theme requirement exists.
8. Update metadata from Create Next App defaults to ARISE branding.
9. Run auth component tests and verify unauthenticated routes in a browser.

## Task 4: Build Shared Portal Shell

**Files:**

- Create: `src/app/(portal)/layout.tsx`
- Create: `src/components/app/portal-shell.tsx`
- Create: `src/components/app/portal-header.tsx`
- Create: `src/components/app/portal-navigation.tsx`
- Create: `src/components/app/portal-loading.tsx`
- Create: `src/components/app/access-denied.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/components/portal-shell.test.tsx`

### Steps

1. Write tests for role-specific navigation visibility, pending session state, unsupported role handling, sign-out action, and mobile navigation behavior.
2. Build the shell on the existing `sidebar`, `sheet`, `button`, `avatar`, `separator`, and `skeleton` primitives instead of adding another layout library.
3. Render navigation from server-returned roles only for UX. Never hide a route as a substitute for API authorization.
4. Use a desktop sidebar and mobile sheet with a persistent top header, page title, role label, and sign-out control.
5. Add accessible landmarks, skip link, focus styles, keyboard navigation, reduced-motion-safe transitions, and visible loading/error states.
6. Establish a focused ARISE visual language: deep ink/navy structure, warm paper surfaces, amber risk accents, and semantic status labels that remain understandable without color.
7. Run shell tests and check the shell at 360px, 768px, and 1024px widths.

## Task 5: Build Student Portal

**Files:**

- Create: `src/app/(portal)/student/page.tsx`
- Create: `src/components/student/student-dashboard.tsx`
- Create: `src/components/student/risk-status-card.tsx`
- Create: `src/components/student/subject-card.tsx`
- Create: `src/components/student/attendance-history.tsx`
- Create: `src/components/student/counselor-card.tsx`
- Create: `src/components/student/consent-gate.tsx`
- Create: `src/components/student/support-signal-dialog.tsx`
- Test: `tests/components/student-dashboard.test.tsx`

### Steps

1. Write component tests for loading, consent-required, empty subjects, risk states, attendance/grade display, support confirmation, duplicate-submit prevention, and API errors.
2. Fetch the student dashboard only after the authenticated role is known. Do not render stale protected data while a consent request is pending.
3. Implement `ConsentGate` using the existing privacy-consent GET/POST contract and display the current policy before acceptance.
4. Implement the dashboard status card with text labels and accessible icons for green/amber/red risk states.
5. Implement compact subject cards showing course identity, absence usage, remaining absences, current grade marks, trend, and expandable attendance history.
6. Implement the assigned counselor contact card from the dashboard DTO. Do not add messaging or appointment controls.
7. Implement the single support-signal action with a confirmation dialog, empty request body, pending state, and success/error feedback.
8. Verify that `401`, `403`, `404`, and `CONSENT_REQUIRED` produce controlled UI states with no protected-data leakage.
9. Run student component tests and verify the mobile layout.

## Task 6: Build Faculty Portal

**Files:**

- Create: `src/app/(portal)/faculty/page.tsx`
- Create: `src/app/(portal)/faculty/sections/[sectionId]/page.tsx`
- Create: `src/app/(portal)/faculty/referrals/page.tsx`
- Create: `src/components/faculty/section-list.tsx`
- Create: `src/components/faculty/section-workspace.tsx`
- Create: `src/components/faculty/roster-table.tsx`
- Create: `src/components/faculty/session-picker.tsx`
- Create: `src/components/faculty/session-form.tsx`
- Create: `src/components/faculty/attendance-editor.tsx`
- Create: `src/components/faculty/referral-dialog.tsx`
- Create: `src/components/faculty/referral-tracking-table.tsx`
- Test: `tests/components/faculty-portal.test.tsx`

### Steps

1. Write component tests for section loading/empty states, roster rendering, session creation, session selection, attendance editing, referral validation, duplicate-submit prevention, and tracking isolation in the UI DTO.
2. Build the section list from `GET /api/v1/faculty/sections`; links must use server-returned section IDs and not infer ownership from URL state.
3. Build the section workspace from the roster endpoint. Keep roster presentation and attendance mutation state in separate components.
4. Load sessions from the new `GET` endpoint and provide a create-session dialog using the existing strict session schema.
5. Implement attendance controls for present, absent, late, and excused. Require an explicit save action, show unsaved local edits, disable duplicate submissions, and invalidate roster/session queries after success.
6. Implement the referral dialog with only `studentId` and optional trimmed `contextualNote`. Do not render counselor identity selection, case status editing, or counselor notes.
7. Build the referral tracking table from the faculty-owned referrals endpoint, showing only compact student identity, section, timestamp, and status.
8. Keep grade navigation absent and document the deliberate deferral in the faculty empty/navigation state only if needed.
9. Run faculty component tests and verify the roster at mobile and desktop widths.

## Task 7: Build Counselor Portal

**Files:**

- Create: `src/app/(portal)/counselor/page.tsx`
- Create: `src/app/(portal)/counselor/cases/[caseId]/page.tsx`
- Create: `src/components/counselor/case-list.tsx`
- Create: `src/components/counselor/case-filter.tsx`
- Create: `src/components/counselor/case-detail.tsx`
- Create: `src/components/counselor/status-history.tsx`
- Create: `src/components/counselor/status-transition-form.tsx`
- Create: `src/components/counselor/intervention-note-form.tsx`
- Test: `tests/components/counselor-portal.test.tsx`

### Steps

1. Write component tests for assigned-case loading/empty states, status filtering, case detail history, status mutation, note validation, duplicate-submit prevention, and `404` access denial.
2. Build the case list from the counselor cases endpoint with only the supported status filter values.
3. Render source, student identity, opened time, and current status in the list. Do not add search, pagination, or generic filters.
4. Build the case detail from the assigned case endpoint with ordered immutable status history and intervention notes.
5. Implement status transitions using the strict `{ status }` body and invalidate list/detail queries after success.
6. Implement intervention notes using a trimmed non-empty body, pending state, and safe error feedback.
7. Preserve canonical case URLs. Do not use parallel routes or modal interception in this sprint.
8. Treat missing or forbidden cases as unavailable without attempting to reveal another counselor’s ownership.
9. Run counselor component tests and verify the desktop-first case workflow plus mobile fallback.

## Task 8: Integration, Accessibility, And Verification

**Files:**

- Modify: `README.md`
- Modify: `docs/api/sprint-1.md`
- Modify: `docs/api/sprint-2-auth.md`
- Modify: `docs/api/sprint-3-interventions.md`
- Create: `docs/api/sprint-4-frontend.md`
- Test: `tests/integration/frontend-contracts.test.ts`

### Steps

1. Add focused integration tests for the API-client contracts and route/query invalidation behavior using mocked responses; do not require a production database for component tests.
2. Verify keyboard navigation, focus visibility, dialog focus trapping, form error association, semantic landmarks, color contrast, and reduced-motion behavior.
3. Verify the UI never renders counselor notes in faculty tracking and never uses client-provided ownership fields.
4. Verify direct navigation to each portal route produces a safe signed-out state and does not rely on middleware-only checks.
5. Verify same-origin redirect handling for sign-in, activation, and reset flows.
6. Document the implemented UI routes, deferred grade/registrar scope, auth/session boundary, and backend endpoint dependencies.
7. Run `pnpm test`.
8. Run `pnpm exec tsc --noEmit`.
9. Run Biome on all touched files.
10. Run `pnpm build` with a valid local `BETTER_AUTH_SECRET` of at least 32 characters.

## Sprint 4 Acceptance Criteria

- Unauthenticated users can sign in, activate/reset a password, view verification feedback, and sign out.
- Authenticated users are routed to explicit student, faculty, or counselor portal paths based on server-derived ARISE roles.
- Students can complete consent, view their dashboard, and submit one confidential support signal through the existing API.
- Faculty can select an assigned section, create/select sessions, record attendance, create eligible referrals, and view only their own referral tracking data.
- Counselors can list, filter, inspect, transition, and annotate only assigned cases.
- Every portal handles loading, empty, validation, unauthorized, forbidden, missing, consent-required, and mutation-error states without exposing sensitive data.
- No browser-stored session token, client-side authorization model, parallel-route complexity, grade-entry UI, registrar UI, messaging, reminder, notification, analytics, or generic workflow framework is introduced.
