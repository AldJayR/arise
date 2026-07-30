# ARISE Database Design

**Release:** RC 1.0.0  
**Database:** PostgreSQL 16+  
**ORM:** Drizzle ORM 1.0.0-rc.4  
**Migration:** generated under `drizzle/` by `pnpm db:generate`

## Design Decisions

- The write model is normalized to BCNF wherever the required dependencies permit it.
- The schema uses domain boundaries: `identity`, `academic`, `services`, `risk`, `integration`, `governance`, and `common`.
- PostgreSQL `text` is used for unconstrained strings. Business limits are enforced with named `CHECK` constraints rather than `varchar(n)`.
- UUIDs are surrogate row identifiers. Institutional student numbers, employee numbers, codes, and composite business keys are enforced with `UNIQUE` constraints.
- All event times use `timestamptz` and are stored in UTC by the application/database contract.
- Derived dashboard values are query projections, not duplicated source columns.
- Financial data is represented only by `hold_active boolean`; no monetary column exists.
- Sensitive tables use PostgreSQL RLS. Application roles are `NOLOGIN`, `NOSUPERUSER`, `NOBYPASSRLS`, and do not own application tables.
- Audit RLS permits service/admin inserts and auditor reads, with no update/delete policies for application roles.

## Repository Layout

Drizzle Kit is configured with `schema: "./src/db/schema/index.ts"`. The barrel export is intentional: Drizzle RC 1.0 scans the exported model graph once and avoids duplicate table discovery while keeping domain modules independently maintainable.

```text
src/db/
  client.ts
  schema/
    academic.ts
    enums.ts
    governance.ts
    identity.ts
    index.ts
    integration.ts
    risk.ts
    rls.ts
    services.ts
```

The modules group tightly related tables rather than forcing artificial one-line files. Each table remains independently exported from its domain module and from `schema/index.ts`.

## Relation Catalog

### Identity

| Relation | Candidate keys | Purpose |
| --- | --- | --- |
| `identity.persons` | `id`, `institutional_email` when present | One human identity and non-derived contact attributes. |
| `identity.students` | `id`, `person_id`, `institutional_student_number` | Student subtype and immutable institutional identifier. |
| `identity.employees` | `id`, `person_id`, `employee_number` | Employee subtype. |
| `identity.user_accounts` | `id`, `person_id`, `authentication_subject` | Authentication identity, separated from person/student facts. |
| `identity.roles` | `id`, `code` | RBAC roles. |
| `identity.permissions` | `id`, `code` | RBAC permissions. |
| `identity.user_roles` | `(user_account_id, role_id)` | User-to-role junction. |
| `identity.role_permissions` | `(role_id, permission_id)` | Role-to-permission junction. |

### Academic

| Relation | Candidate keys | Purpose |
| --- | --- | --- |
| `academic.colleges` | `id`, `code` | College catalog. |
| `academic.programs` | `id`, `code` | Program owned by one college. |
| `academic.academic_terms` | `id`, `code` | Term calendar. |
| `academic.courses` | `id`, `code` | Course catalog. |
| `academic.curriculum_courses` | `(program_id, course_id, effective_term_id)` | Program curriculum junction. |
| `academic.sections` | `id`, `(course_id, term_id, section_code)` | Course offering. |
| `academic.section_instructors` | `(section_id, employee_id)` | Instructor assignment junction. A partial unique index permits one primary instructor. |
| `academic.enrollments` | `id`, `(student_id, section_id)` | Student participation in a section. |
| `academic.grade_periods` | `id`, `code`, `sequence` | Prelim, midterm, and final dimensions. |
| `academic.grade_records` | `id`, `(enrollment_id, grade_period_id)` | One mark per enrollment and grading period. |
| `academic.class_sessions` | `id`, `(section_id, session_sequence)` | Session occurrence. |
| `academic.attendance_policies` | `id`, `section_id` | One published attendance policy per section. |
| `academic.attendance_records` | `id`, `(session_id, enrollment_id)` | One attendance fact at the session/enrollment grain. |

### Student Services

| Relation | Candidate keys | Purpose |
| --- | --- | --- |
| `services.attendance_policy_acknowledgments` | `(student_id, policy_id)` | Subject policy acknowledgment. |
| `services.privacy_policies` | `id`, `version` | Versioned privacy notice. |
| `services.consent_records` | `id`, `(student_id, policy_id, purpose)` | Explicit consent state and capture time. |
| `services.counselor_assignments` | `id` plus temporal business constraint | Non-overlapping counselor assignment intervals. |
| `services.support_signals` | `id` | Confidential student support request. |
| `services.counselor_referrals` | `id` | Faculty referral fact. |
| `services.referral_status_history` | `id` | Referral state transition history. |
| `services.cases` | `id`, `source_support_signal_id` when signal-sourced | Counselor case. Current status is derived from history. |
| `services.case_status_history` | `id` | Case state transition history. |
| `services.intervention_notes` | `id` | Attributed counselor note. |
| `services.follow_up_reminders` | `id` | Case reminder. |
| `services.message_threads` | `id`, `(student_id, counselor_employee_id)` | Direct communication thread. |
| `services.messages` | `id`, `(thread_id, sequence)` | Ordered message fact. |
| `services.notifications` | `id` | Push, SMS, email, and portal delivery queue. |

### Risk, Integration, and Governance

| Relation | Candidate keys | Purpose |
| --- | --- | --- |
| `risk.risk_rule_definitions` | `id`, `code` | Stable rule identity. |
| `risk.risk_rule_versions` | `id`, `(rule_definition_id, version)` | Versioned configurable threshold. |
| `risk.risk_evaluations` | `id` | Evaluation run for one student. |
| `risk.risk_signals` | `id` | Triggered rule signal. |
| `risk.risk_signal_enrollments` | `(risk_signal_id, enrollment_id)` | Signal-to-subject junction. |
| `risk.weekly_delta_digests` | `id`, `(counselor_employee_id, window_starts_at, window_ends_at)` | Generated digest snapshot. |
| `risk.weekly_delta_digest_entries` | `(digest_id, student_id)`, `(digest_id, rank)` | Ranked digest entries. |
| `integration.import_batches` | `id`, `source_batch_key` | External ingestion batch. |
| `integration.external_student_mappings` | `(source_system, external_student_key)`, `(student_id, source_system)` | Cross-system identity mapping. |
| `integration.financial_hold_snapshots` | `id`, `(student_id, source_system, effective_at)` | Binary-only hold history. |
| `integration.offline_sync_operations` | `id`, `client_operation_id` | Immutable offline attendance command. |
| `integration.sync_conflicts` | `id`, `(operation_id, winning_operation_id)` | LWW/vector-clock collision record. |
| `integration.ingestion_discrepancies` | `id` | Data quality exception. |
| `integration.discrepancy_resolutions` | `id` | Attributed discrepancy resolution. |
| `governance.audit_events` | `id` | PII/SPI access and mutation evidence. |

## Normalization Process

### Starting Unnormalized Record

The initial business record can be represented conceptually as:

```text
STUDENT_ACTIVITY(
  student_number, student_name, program_code, college_name,
  term_code, course_code, course_title, section_code,
  instructor_name, {session_date, attendance_status}*,
  {grade_period, grade_value}*, financial_hold,
  {counselor_note, note_author, note_time}*
)
```

This has repeating attendance, grade, and intervention groups. It also mixes facts with different determinants and creates update, insertion, and deletion anomalies.

### First Normal Form

Each repeating group becomes a relation with atomic values:

- Attendance becomes `attendance_records(session_id, enrollment_id, status, ...)`.
- Grades become `grade_records(enrollment_id, grade_period_id, mark_kind, numeric_value, ...)`.
- Notes become `intervention_notes(case_id, author_employee_id, recorded_at, note)`.
- A student/course offering relationship becomes `enrollments(student_id, section_id, ...)`.

No array or delimited string represents a set of attendance, grade, counselor, or role facts. `vector_clock` and notification metadata are JSONB only because they are transport payloads, not relational determinants; their source operation remains relational and typed.

### Second Normal Form

For every composite key, attributes depending on only part of the key were removed:

- `attendance_records(session_id, enrollment_id, ...)` has no session date, section, course, or student name. Those depend only on `session_id`, `session_id -> class_sessions`.
- `grade_records(enrollment_id, grade_period_id, ...)` has no period name or enrollment student/section data. Period attributes depend only on `grade_period_id`; enrollment attributes depend only on `enrollment_id`.
- `enrollments(student_id, section_id, ...)` has no student identity, course, term, or section description.
- `user_roles(user_account_id, role_id)` has no user or role description.
- `curriculum_courses(program_id, course_id, effective_term_id)` has no program, course, or term description.

Therefore no non-key attribute depends on a proper subset of a composite candidate key.

### Third Normal Form

Transitive chains were separated:

```text
student_id -> person_id -> legal_name
program_id -> college_id -> college_name
section_id -> course_id -> course_title
section_id -> term_id -> term_dates
enrollment_id -> section_id -> course_id
case_id -> assigned_counselor_employee_id -> employee identity
thread_id -> counselor_employee_id -> employee identity
evaluation_id -> student_id -> person identity
```

The determinant's descriptive attributes exist only in its owning relation. No table stores `college_name` in `programs`, `course_title` in `sections`, student names in `enrollments`, or counselor names in cases/messages.

### Hidden Dependencies

- Institutional numbers determine their subtype rows, but not person descriptions. This is represented by unique alternate keys on `students.institutional_student_number` and `employees.employee_number`.
- `(course_id, term_id, section_code) -> section_id` is enforced by a unique constraint. Course and term descriptions remain in their parent tables.
- `(session_id, enrollment_id) -> attendance status` is enforced by a unique constraint. Neither component alone determines the attendance fact.
- `(enrollment_id, grade_period_id) -> mark` is enforced by a unique constraint. `grade_period_id -> sequence/code` remains in `grade_periods`.
- `(student_id, policy_id, purpose) -> consent state/capture` is enforced by a unique constraint. Policy text remains in `privacy_policies`.
- A case's current status is not a stored attribute. It is the latest `case_status_history` row, preventing a duplicated current-status dependency.
- Risk color, GWA, absence percentage, trend, and retention rate are query projections. They are not determinants in the write model.

## Functional Dependency Cover

The following is a minimal-cover style set. Right-hand sides are shown as grouped for readability; implementation constraints enforce the individual dependencies.

```text
institutional_student_number -> student_id
employee_number -> employee_id
person_id -> student_id when the person is a student
person_id -> employee_id when the person is an employee

college_code -> college_id, college_name
program_code -> program_id, college_id, program_name, degree_type
term_code -> term_id, academic_year, kind, starts_on, ends_on
course_code -> course_id, course_title, credit_units

(program_id, course_id, effective_term_id) -> required
(course_id, term_id, section_code) -> section_id, capacity, status
(section_id, employee_id) -> assignment_role, assigned_at
(student_id, section_id) -> enrollment_id, enrollment_status, enrolled_at
(section_id, session_sequence) -> session_id, session_times, session_type
(session_id, enrollment_id) -> attendance_status, attendance_source, recorded_at
(enrollment_id, grade_period_id) -> grade_mark_kind, numeric_value, submission facts

(student_id, policy_id, purpose) -> consent_state, captured_at, withdrawn_at
(student_id, effective_from) -> counselor assignment fact
(thread_id, sequence) -> message sender/body/times
(case_id, changed_at) -> case status transition fact

risk_rule_code -> rule_definition_id, rule description
(rule_definition_id, version) -> threshold_value, threshold_unit, active interval
(evaluation_id, rule_version_id) -> triggered signal fact
(risk_signal_id, enrollment_id) -> signal-subject membership

(student_id, source_system, effective_at) -> hold_active
client_operation_id -> offline operation fact
(operation_id, winning_operation_id) -> sync conflict fact
```

Armstrong derivations used by the decomposition:

- Reflexivity gives `{student_id, section_id} -> student_id`.
- Augmentation gives `(course_id, term_id, section_code, employee_id) -> section_id` from the section candidate key.
- Transitivity gives `enrollment_id -> section_id -> course_id -> course_code`; this proves course code must not be copied into `enrollments`.
- Pseudotransitivity gives `attendance_record_key -> enrollment_id -> student_id`; this is why attendance can identify its student through a foreign-key path without storing `student_id` again.
- Decomposition splits grouped right-hand sides into individual dependencies for key/unique/check enforcement.

## BCNF Review

For each write relation, every nontrivial determinant is a superkey or is isolated in a parent relation:

- `persons`: `id` is the key; no non-key determinant is stored.
- `students`: `id`, `person_id`, and institutional number are candidate keys; all student subtype attributes depend on one of them.
- `programs`, `courses`, `academic_terms`: surrogate ID and immutable business code are candidate keys; descriptions are not copied into children.
- `sections`: `id` and `(course_id, term_id, section_code)` are candidate keys.
- `enrollments`: `id` and `(student_id, section_id)` are candidate keys.
- `attendance_records`: `id` and `(session_id, enrollment_id)` are candidate keys.
- `grade_records`: `id` and `(enrollment_id, grade_period_id)` are candidate keys.
- Junction tables use their complete composite key and contain only relationship facts.
- History/event tables use an immutable event ID; their timestamp is part of event ordering, not a determinant of another non-key attribute.
- `risk_rule_versions` isolates `(rule_definition_id, version)` from rule definition attributes.
- `risk_signal_enrollments` and digest entries contain only membership/ranking facts.

The schema does not require a 3NF exception in RC 1.0.0. Temporal assignment overlap is a workflow validation concern and is not represented by duplicated attributes.

## Lossless Join Proofs

For a decomposition `R -> R1, R2`, the shared attributes determine at least one component. The important decompositions satisfy:

| Decomposition | Common determinant | Lossless reason |
| --- | --- | --- |
| Person and student subtype | `person_id` | `person_id -> persons` attributes. |
| Person and employee subtype | `person_id` | `person_id -> persons` attributes. |
| College and program | `college_id` | `college_id -> college` attributes. |
| Course and section | `course_id` | `course_id -> course` attributes. |
| Term and section | `term_id` | `term_id -> term` attributes. |
| Section and enrollment | `section_id` | `section_id -> section` attributes. |
| Enrollment and attendance | `enrollment_id` | `enrollment_id -> enrollment` attributes. |
| Session and attendance | `session_id` | `session_id -> session` attributes. |
| Enrollment and grade record | `enrollment_id` | `enrollment_id -> enrollment` attributes. |
| Grade period and grade record | `grade_period_id` | `grade_period_id -> grade period` attributes. |
| Policy and consent | `policy_id` | `policy_id -> privacy policy` attributes. |
| Case and case history | `case_id` | `case_id -> case` attributes. |
| Thread and message | `thread_id` | `thread_id -> message thread` attributes. |
| Rule definition and rule version | `rule_definition_id` | Definition attributes remain in the determinant relation. |
| Evaluation and signal | `evaluation_id` | Evaluation attributes remain in `risk_evaluations`. |

The lossless property also follows from the standard synthesis condition: every synthesized relation contains a key for a relation in the decomposition, and all foreign keys reference that key.

## Dependency Preservation

Every dependency in the cover is enforceable locally:

- Single-row determinants use `PRIMARY KEY` or `UNIQUE`.
- Composite determinants use composite `PRIMARY KEY` or `UNIQUE`.
- Domain dependencies use PostgreSQL enum types and named `CHECK` constraints.
- Parent-child dependencies use foreign keys.
- Temporal dependency/non-overlap uses `EXCLUDE USING gist`.
- Derived dependencies are implemented as query projections and are intentionally not treated as source-table FDs.

No application join is required to enforce a key dependency. Cross-row authorization dependencies are RLS policy functions, not normalization dependencies.

## Foreign-Key Graph Safety

The ownership graph is acyclic:

```text
persons -> students / employees -> user_accounts -> user_roles
colleges -> programs -> curriculum_courses
courses + academic_terms -> sections -> class_sessions
students + sections -> enrollments -> attendance_records / grade_records
students -> consent / counselor assignments / support cases / messages
risk rules + evaluations -> signals -> signal subjects
external batches -> discrepancies -> resolutions
```

There are no relational design loops such as `A -> B -> C -> D -> A`. Junctions such as `section_instructors`, `curriculum_courses`, and `risk_signal_enrollments` represent independent many-to-many facts; they do not own copies of either endpoint.

There are no diamond dependencies in the source model. A child references its immediate determinant only. For example, attendance references `session_id` and `enrollment_id`, not duplicated `section_id`, `course_id`, or `student_id`. Reports may join multiple paths, but those are read projections, not foreign-key ownership paths.

## RLS Contract

Run `pnpm db:migrate` and then `pnpm db:provision` using a deployment owner connection. The application must connect with a least-privileged non-owner role and set transaction-local context through `withRlsContext` before querying:

```sql
BEGIN;
SELECT set_config('app.student_id', '<student-uuid>', true);
SELECT set_config('app.person_id', '<person-uuid>', true);
SELECT set_config('app.employee_id', '<employee-uuid>', true);
SELECT set_config('app.user_account_id', '<user-account-uuid>', true);
COMMIT;
```

`withRlsContext` keeps these values transaction-local. The API must derive them from the authenticated server session and must never accept a client-provided identity as an authorization source.

The migration creates non-login roles for portal classes. The backend should `SET ROLE` to the least-privileged role for each request. The service role is reserved for trusted server-side workflows and ingestion workers.

The Sprint 1 prototype uses `withActorTransaction` to resolve a development actor, set transaction-local RLS identity values, and run each service workflow inside one transaction. The production authentication adapter must replace the development header and select the corresponding least-privileged database role before the transaction begins.

Sprint 2 keeps this domain boundary: Better Auth will own credentials and sessions, while `identity.user_accounts.authentication_subject` will link the Better Auth user ID to ARISE persons, students, employees, roles, permissions, consent, and RLS context. See [`plans/2026-07-30-sprint-2-auth.md`](plans/2026-07-30-sprint-2-auth.md).

## Requirements Traceability

| SRS area | Implementation |
| --- | --- |
| `STU-FR-001` and risk status | `risk.risk_*`, risk status query projection. |
| `STU-FR-002`, `STU-FR-004` | `academic.attendance_records`, attendance summary query projection. |
| `STU-FR-003` and `FAC-FR-003` | `integration.offline_sync_operations`, `integration.sync_conflicts`, LWW service logic, notification queue. |
| `STU-FR-007`, `CNS-FR-009`, `NFR-SEC-005` | `services.support_signals` and counselor-only RLS policy. |
| `STU-FR-011` | `services.privacy_policies`, `services.consent_records`. |
| `FAC-FR-001`, `FAC-FR-004`, `FAC-FR-009` | Academic attendance, grade, and import relations with enum/check enforcement. |
| `FAC-FR-007`, `FAC-FR-011` | `services.counselor_referrals`, `services.referral_status_history`. |
| `CNS-FR-001` and `CNS-FR-011` | `risk.weekly_delta_digests`, digest entries, and reporting queries. |
| `CNS-FR-004` through `CNS-FR-008` | Cases, status history, notes, reminders, threads, and messages. |
| `REG-FR-001` through `REG-FR-009` | Canonical identity/academic/integration relations and `governance.audit_events`. |
| `DEA-FR-001` through `DEA-FR-010` | Risk/academic read projections and analytics queries; no duplicated source facts. |
| `NFR-SEC-001` through `NFR-SEC-005` | TLS/AES deployment controls, role grants, RLS, audit insert/read controls, binary hold design. |
| `NFR-REL-002` | Persistent offline operation log and conflict provenance. |
| `NFR-MAINT-001`, `NFR-MAINT-002` | Versioned rule definition/threshold tables and isolated risk schema. |
