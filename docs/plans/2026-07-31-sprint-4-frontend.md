# Sprint 4 Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build the smallest secure frontend for the implemented Better Auth, student, faculty, and counselor workflows after their read contracts are correct.

**Architecture:** Use standard Next.js App Router nested routes with route groups, not parallel routes. `(public)` owns unauthenticated pages, while an authenticated server layout resolves a safe ARISE profile before rendering `(portal)`. TanStack Query owns interactive API state; API authorization and PostgreSQL RLS remain the only security boundary.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 7, Better Auth React client, TanStack Query, Tailwind CSS 4, existing Base UI/shadcn primitives, Lucide icons, Sonner, Vitest, Biome.

---

## Sprint Boundary

### In Scope

- Better Auth sign-in, sign-out, password activation/reset, and verification feedback.
- Authenticated role routing for student, faculty, and counselor users.
- Student dashboard, consent gate, and confidential support-signal action.
- Faculty section list, roster, class-session creation/selection, attendance capture, referral creation, and referral tracking.
- Counselor assigned-case list, status filtering, case detail, status transitions, and intervention notes.
- Responsive shared shell, loading/empty/error states, keyboard accessibility, manual browser verification, and focused API/client contract tests.
- The narrow backend read and correctness fixes required by the frontend: safe profile, faculty session listing, selected-session attendance, correct student attendance totals, and server-owned referral eligibility when referrals remain in scope.

### Explicitly Deferred

- Registrar account-provisioning UI.
- Faculty grade entry until a read contract exposes existing grade periods and records.
- Direct messaging, warm nudges, reminders, notifications, scheduled jobs, analytics, reports, exports, search, offline sync, and integrations.
- Parallel routes, intercepting routes, catch-all routes, generic portal frameworks, client-side authorization models, and local-storage session state.
- Automated DOM/UI test harnesses and extra frontend state-management libraries.

## Routing Decision

Use route groups and ordinary nested routes:

```text
src/app/
  (public)/
    layout.tsx
    page.tsx
    sign-in/page.tsx
    auth/activate/page.tsx
    auth/password/page.tsx
    auth/verify/page.tsx
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
- Authentication flows use fixed destinations; no arbitrary client-provided redirect target is introduced.
- Client forms send only fields already accepted by the API contracts. They never send actor, author, owner, counselor, or database-role fields.
- Error rendering uses the common error envelope and does not display raw server/database errors.
- Sensitive student/counselor content is never placed in URL query parameters, browser storage, or analytics payloads.

## Task 1: Add Frontend Read Contracts

**Files:**

- Create: `src/server/services/profile.ts`
- Create: `src/app/api/v1/me/route.ts`
- Modify: `src/server/services/student.ts`
- Modify: `src/server/services/academic.ts`
- Modify: `src/server/services/interventions.ts`
- Modify: `src/server/validation/faculty.ts`
- Modify: `src/app/api/v1/faculty/sections/[sectionId]/sessions/route.ts`
- Modify: `src/app/api/v1/faculty/sections/[sectionId]/attendance/route.ts`
- Test: `tests/server/profile.test.ts`
- Test: `tests/services/academic.test.ts`
- Test: `tests/services/student.test.ts`
- Test: `tests/services/interventions.test.ts`

### Steps

1. Write a regression test proving a student's absence count excludes attendance records belonging to other enrollments in the same session.
2. Fix the student dashboard attendance aggregation by joining attendance records through both session ID and enrollment ID.
3. Write tests for the safe actor profile DTO. It may expose display name, institutional email when available, and ARISE roles; it must omit database role, permissions not needed by the UI, raw account identifiers, and authentication subjects.
4. Implement `getAuthenticatedProfile` in `profile.ts` and the thin `GET /api/v1/me` route through `withActorTransaction`. Keep `Actor` as an authorization-only type.
5. Write tests for faculty session listing and selected-session attendance scoped to an assigned section.
6. Implement `listClassSessions` and a selected-session attendance read, reusing `getOwnedSection`, with only the IDs and status/timestamp fields required to hydrate the editor.
7. Expose the reads beside the existing faculty session and attendance routes. Keep route adapters limited to parameter/query validation, transaction setup, and service invocation.
8. If referral UI remains in scope, expose real compact risk summaries in the roster and enforce the same eligibility rule in the referral service. Otherwise relabel Sprint 4 referrals as intake-only rather than eligible-risk referrals.
9. Run the targeted contract/service tests, then `npx tsc --noEmit`.

## Task 2: Add Browser Auth And API Clients

**Files:**

- Create: `src/lib/auth-client.ts`
- Create: `src/lib/api/client.ts`
- Create: `src/components/providers/query-provider.tsx`
- Test: `tests/client/api-client.test.ts`

### Steps

1. Write API-client tests for credentials-included requests, JSON success parsing, the shared error envelope, malformed responses, `401`, `403`, `404`, and `CONSENT_REQUIRED` handling.
2. Implement `auth-client.ts` with Better Auth `createAuthClient` using the same-origin auth route. Export the supported session, email sign-in, sign-out, password-reset, and verification operations without wrapping them in a second auth abstraction.
3. Implement a small typed `apiFetch` helper. Default to same-origin relative URLs and `credentials: "include"`; allow only explicit HTTP methods and JSON bodies required by Sprint 4.
4. Define response types next to each feature client rather than creating one central all-feature DTO registry. Never import Drizzle/server types into browser bundles.
5. Add a single TanStack Query provider with bounded stale/gc times, no mutation retries, no persistent cache, and no retries for `401`, `403`, `404`, `409`, or consent errors.
6. Clear the query client on sign-out and on an authenticated `401`. Do not render cached protected data while the profile or consent state is unresolved.
7. Run client contract tests, Biome, and TypeScript.

## Task 3: Build Public Auth Routes

**Files:**

- Move: `src/app/page.tsx` to `src/app/(public)/page.tsx`
- Create: `src/app/(public)/layout.tsx`
- Create: `src/app/(public)/sign-in/page.tsx`
- Create: `src/app/(public)/auth/activate/page.tsx`
- Create: `src/app/(public)/auth/password/page.tsx`
- Create: `src/app/(public)/auth/verify/page.tsx`
- Create: `src/components/auth/sign-in-form.tsx`
- Create: `src/components/auth/password-form.tsx`
- Create: `src/components/auth/verification-status.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/client/auth-contract.test.ts`

### Steps

1. Write client-contract tests for the supported Better Auth operations and their controlled error states.
2. Replace the starter home screen with a compact ARISE entry page containing a clear sign-in action and no protected data.
3. Implement `SignInForm` with accessible labels, field-level validation, pending state, and verification-required feedback. Use fixed post-auth destinations rather than arbitrary return paths.
4. Implement one reusable password form for the existing `/auth/activate` token and any reset token. Read only the token required by Better Auth from the URL; never persist or log it.
5. Implement verification feedback at `/auth/verify` for success, expired/invalid links, and resend guidance using Better Auth’s supported client operation.
6. Put a small reset-request action on sign-in only if the complete request-email-to-token flow is included in this sprint.
7. Keep the profile/session redirect in the authenticated server layout; do not add a client-side session router abstraction.
8. Add one root toaster with a fixed/system theme and no theme-provider requirement. Update metadata from Create Next App defaults to ARISE branding.
9. Run auth contract tests and verify unauthenticated routes and issued email links in a browser.

## Task 4: Build Shared Portal Shell

**Files:**

- Create: `src/app/(portal)/layout.tsx`
- Create: `src/app/(portal)/loading.tsx`
- Create: `src/app/(portal)/error.tsx`
- Create: `src/app/(portal)/student/layout.tsx`
- Create: `src/app/(portal)/faculty/layout.tsx`
- Create: `src/app/(portal)/counselor/layout.tsx`
- Create: `src/components/app/portal-shell.tsx`
- Modify: `src/app/globals.css`

### Steps

1. Resolve the safe profile in the authenticated server layout and render a controlled unsupported-role state before protected content mounts.
2. Add small nested role layouts that guard direct navigation for student, faculty, and counselor routes. Keep API authorization unchanged.
3. Build one shell on the existing primitives instead of adding another layout library. Use a simple responsive navigation before adopting the generated collapsible sidebar.
4. Add sign-out, skip link, one main landmark, visible focus styles, keyboard navigation, reduced-motion-safe transitions, and loading/error boundaries.
5. Establish a focused ARISE visual language: deep ink/navy structure, warm paper surfaces, amber risk accents, and semantic status labels that remain understandable without color.
6. Check the shell manually at 360px, 768px, and 1024px widths and with keyboard navigation.

## Task 5: Build Student Portal

**Files:**

- Create: `src/app/(portal)/student/page.tsx`
- Create: `src/components/student/student-dashboard.tsx`
- Create: `src/components/student/consent-gate.tsx`
- Create: `src/components/student/support-signal-dialog.tsx`

### Steps

1. Fetch consent before the student dashboard and do not render protected data while consent is unresolved.
2. Implement `ConsentGate` using the existing privacy-consent GET/POST contract and display the current policy before acceptance.
3. Implement the dashboard in one feature container with text-labeled green/amber/red risk states, subject attendance/grade data, counselor contact, and expandable history only where the existing DTO supports it.
4. Keep the counselor card informational. Do not add messaging, appointments, or speculative fields such as office hours.
5. Implement the single support-signal action with a confirmation dialog, bodyless request, pending state, duplicate-submit prevention, and safe success/error feedback.
6. Verify `401`, `403`, `404`, and `CONSENT_REQUIRED` manually with no protected-data leakage, then verify the mobile layout.

## Task 6: Build Faculty Portal

**Files:**

- Create: `src/app/(portal)/faculty/page.tsx`
- Create: `src/app/(portal)/faculty/sections/[sectionId]/page.tsx`
- Create: `src/app/(portal)/faculty/referrals/page.tsx`
- Create: `src/components/faculty/section-workspace.tsx`
- Create: `src/components/faculty/attendance-editor.tsx`
- Create: `src/components/faculty/referral-dialog.tsx`

### Steps

1. Build the section list from `GET /api/v1/faculty/sections`; links must use server-returned section IDs and not infer ownership from URL state.
2. Build the section workspace from the roster endpoint after real compact risk summaries are available. Keep local attendance draft state separate from server data.
3. Load sessions from the new `GET` endpoint and use a small create-session form with the existing strict session schema.
4. Load selected-session attendance before rendering controls. Track dirty edits, confirm before switching sessions, require explicit save, disable duplicate submissions, and invalidate only affected queries after success.
5. Implement the referral dialog with only `studentId` and optional trimmed `contextualNote`. Do not render counselor selection, case status editing, or counselor notes.
6. Build referral tracking from the faculty-owned endpoint, showing only compact student identity, section, timestamp, and status. Include referral creation only if server-side eligibility is implemented; otherwise label it intake-only.
7. Keep grade navigation absent and document the deliberate deferral in the faculty empty/navigation state only if needed.
8. Verify API contracts, duplicate-submit behavior, ownership failures, and the roster manually at mobile and desktop widths.

## Task 7: Build Counselor Portal

**Files:**

- Create: `src/app/(portal)/counselor/page.tsx`
- Create: `src/app/(portal)/counselor/cases/[caseId]/page.tsx`
- Create: `src/components/counselor/case-workspace.tsx`

### Steps

1. Build the case list from the counselor cases endpoint with only the supported status filter values in the URL.
2. Render source, student identity, opened time, and current status in one workspace. Do not add search, pagination, or generic filters.
3. Build case detail from the assigned case endpoint with ordered immutable status history and safe attribution; do not expose raw employee IDs unless the UI needs them.
4. Implement status transitions using the strict `{ status }` body and invalidate list/detail queries after success.
5. Implement intervention notes using a trimmed non-empty body, pending state, duplicate-submit prevention, and safe error feedback.
6. Preserve canonical case URLs. Do not use parallel routes or modal interception in this sprint.
7. Treat missing or forbidden cases as unavailable without attempting to reveal another counselor’s ownership, then verify the desktop workflow and mobile fallback manually.

## Task 8: Integration, Accessibility, And Verification

**Files:**

- Modify: `README.md`
- Create: `docs/api/sprint-4-frontend.md`
- Test: `tests/integration/frontend-contracts.test.ts`

### Steps

1. Add focused integration tests for API-client contracts and query invalidation behavior using mocked responses; do not require a production database.
2. Verify keyboard navigation, focus visibility, dialog focus trapping, form error association, semantic landmarks, color contrast, and reduced-motion behavior.
3. Verify the UI never renders counselor notes in faculty tracking and never uses client-provided ownership fields.
4. Verify direct navigation to each portal route produces a safe signed-out state and does not rely on middleware-only checks.
5. Verify the fixed sign-in, activation, password, and verification routes match the links issued by provisioning.
6. Document the implemented UI routes, partial/deferred SRS areas, auth/session boundary, corrected backend read contracts, and endpoint dependencies in `README.md` and the new Sprint 4 API document.
7. Run `pnpm test`.
8. Run `pnpm exec tsc --noEmit`.
9. Run Biome on all touched files.
10. Run `pnpm build` with a valid local `BETTER_AUTH_SECRET` of at least 32 characters.

## Sprint 4 Acceptance Criteria

- Unauthenticated users can sign in, activate/reset a password, view verification feedback, and sign out.
- Authenticated users are routed to explicit student, faculty, or counselor portal paths based on server-derived ARISE roles.
- Students can complete consent, view their dashboard, and submit one confidential support signal through the existing API.
- Faculty can select an assigned section, create/select sessions, record attendance, create referrals only for server-eligible students when that contract is in scope, and view only their own referral tracking data.
- Counselors can list, filter, inspect, transition, and annotate only assigned cases.
- Every portal handles loading, empty, validation, unauthorized, forbidden, missing, consent-required, and mutation-error states without exposing sensitive data. UI behavior is verified manually and through API/client contract tests.
- No browser-stored session token, client-side authorization model, parallel-route complexity, grade-entry UI, registrar UI, messaging, reminder, notification, analytics, or generic workflow framework is introduced.
