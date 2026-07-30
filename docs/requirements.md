SOFTWARE REQUIREMENTS SPECIFICATION (SRS)
ARISE: Academic Risk Intelligence and Student Engagement System

Document Version: 1.1 (Post-Panel Architectural & Compliance Revision)
Conformance Standard: ISO/IEC/IEEE 29148:2018
Regulatory Compliance: Republic Act 10173 (Philippine Data Privacy Act of 2012)
Target Context: Nueva Ecija University of Science and Technology (NEUST) — Pilot Deployment Context
Status: Approved Specification


REVISION HISTORY

Version 1.0 (2026-07-30)
Author: Product Design
Description: Initial SRS derived from Design Thinking process outputs.

Version 1.1 (2026-07-30)
Author: Senior Systems Architect & Enterprise Review Panel
Description: Architectural & Compliance Remediation:
- Reclassified "Anonymous Flags" to "Confidential Support Signals" (STU-FR-007, NFR-SEC-005) for RA 10173 compliance.
- Added mandatory Data Privacy Consent flow (STU-FR-011).
- Defined LWW Vector Clock conflict resolution algorithm for offline attendance sync (FAC-FR-003).
- Rectified Registrar domain boundaries by removing financial write permissions (REG-FR-008).
- Standardized non-numeric grade handling (INC, DRP, P/F) for PH 1.0 - 5.0 scale in Risk Engine (§4.2.3).
- Added Level 0 Context & Level 1 DFD models and fully bidirectional Traceability Matrix.


TABLE OF CONTENTS

1. Introduction
   1.1 Purpose
   1.2 Scope & System Boundaries
   1.3 Intended Audience
   1.4 Definitions, Acronyms, and Abbreviations
   1.5 References
   1.6 Document Conventions
2. Overall Description
   2.1 Product Perspective
   2.2 Product Functionality Summary
   2.3 User Classes and Characteristics
   2.4 Operating Environment
   2.5 Design and Implementation Constraints
   2.6 Assumptions and Dependencies
3. System Modeling
   3.1 Gane-Sarson Data Flow Diagrams (DFD)
   3.2 UML Use Case Specifications
4. System Requirements
   4.1 External Interface Requirements
   4.2 Functional Requirements
       4.2.1 Student Portal
       4.2.2 Faculty Portal
       4.2.3 Risk Detection & Calculation Engine (Rule-Based v1.1)
       4.2.4 Guidance Counselor Portal
       4.2.5 Registrar Portal
       4.2.6 Dean / Academic Administrator Portal
   4.3 Non-Functional Requirements
       4.3.1 Performance & Scalability
       4.3.2 Security, Privacy, and Auditability
       4.3.3 Usability and Accessibility
       4.3.4 Reliability & Data Resiliency
       4.3.5 Maintainability & Architectural Pluggability
5. Verification & Acceptance Criteria
6. Bidirectional Requirements Traceability Matrix (RTM)


===============================================================================
1. INTRODUCTION
===============================================================================

1.1 Purpose
This Software Requirements Specification (SRS) defines the functional and non-functional requirements for ARISE (Academic Risk Intelligence and Student Engagement System). Designed for Philippine State Universities and Colleges (SUCs), ARISE acts as an academic early-warning, risk intelligence, and cross-departmental intervention platform. This document conforms strictly to ISO/IEC/IEEE 29148:2018 and RA 10173 (Philippine Data Privacy Act of 2012). Every requirement is atomic, testable, prioritized, and traceably linked to system architecture components and verification protocols.

1.2 Scope & System Boundaries
ARISE consolidates academic records, session-level attendance, and read-only financial hold status across five role-based portals: Student, Faculty, Guidance Counselor, Registrar, and Dean/Administrator. ARISE does not replace canonical Student Information Systems (SIS) or Enterprise Resource Planning (ERP) systems; it operates as an intelligence layer on top of them.

In Scope:
- Offline-first attendance capture with local caching and deterministic server reconciliation.
- Subject-level grade trend analysis (PH 1.0 - 5.0 scale, including INC, DRP, P/F semantics).
- Automated rule-based risk evaluation and cross-subject risk correlation.
- Confidential student support signaling and structured counselor caseload workflows.
- Registrar data integrity validation, immutable access auditing, and role-based privilege management.
- Program-level academic failure heatmaps, attendance anomaly detection, and institutional reporting.

Out of Scope:
- Direct payment gateway processing or tuition fee computation (financial data is strictly read-only hold status).
- Learning Management System (LMS) features (e.g., assignment submissions, video hosting).
- Predictive Machine Learning scoring in v1.1 (delegated to rule-based threshold parameters; ML pipeline architecture pluggability prepared via NFR-MAINT-002).

1.3 Intended Audience
- Software Development Team / AI Coding Agents: Technical execution baseline.
- System Architects & QA Teams: Test specification design and verification compliance.
- Institutional Stakeholders (Registrar, OSAS, Deans, IT Office): Validation of business logic and regulatory compliance.

1.4 Definitions, Acronyms, and Abbreviations

ARISE: Academic Risk Intelligence and Student Engagement System.
CRDT: Conflict-free Replicated Data Type (used for asynchronous data synchronization).
Delta Digest: A weekly prioritized ranking of advisees experiencing the greatest negative risk change over a rolling 7-day window.
DRP: Dropped status in Philippine SUC grading systems.
GWA: General Weighted Average (Philippine numerical grade point average, where 1.0 is highest and 5.0 is failure).
INC: Incomplete grade status requiring administrative completion within a 1-year window.
LWW: Last-Write-Wins (conflict resolution policy utilizing UTC timestamp vector clocks).
OSAS: Office of Student Affairs and Services.
PII / SPI: Personally Identifiable Information / Sensitive Personal Information under RA 10173.
RA 10173: Republic Act 10173 (Philippine Data Privacy Act of 2012).
RBAC: Role-Based Access Control.
SIS: Student Information System (external canonical records system).
Warm Nudge: A low-pressure, supportively framed message template sent from counselor to student.

1.5 References
- ISO/IEC/IEEE 29148:2018 — Systems and software engineering — Life cycle processes — Requirements engineering.
- Republic Act No. 10173 — Data Privacy Act of 2012 (Philippines) and its Implementing Rules and Regulations (IRR).
- W3C Web Content Accessibility Guidelines (WCAG) 2.1 Level AA.

1.6 Document Conventions
Requirement IDs follow the pattern [MODULE]-[TYPE]-[NUMBER].
- Module Prefixes: STU (Student), FAC (Faculty), CNS (Counselor), REG (Registrar), DEA (Dean), NFR (Non-Functional).
- Type Prefixes: FR (Functional Requirement), PERF (Performance), SEC (Security/Privacy), UX (Usability), REL (Reliability), MAINT (Maintainability).
- Priority Levels:
  * "Shall" denotes a mandatory requirement (Must).
  * "Should" denotes a recommended requirement (Should).
  * "May" denotes an optional capability (Could).


===============================================================================
2. OVERALL DESCRIPTION
===============================================================================

2.1 Product Perspective
ARISE is a standalone web application that interfaces with institutional infrastructure through secure REST APIs and scheduled batch sync jobs. It operates across five unified portals using a shared relational database, caching layer, and asynchronous worker queues.

System Topology Context:
- Student Portal (Mobile First) <---> ARISE Core API Layer <---> Database / Cache
- Faculty Portal (Mobile + Desktop) <---> ARISE Core API Layer <---> Database / Cache
- Guidance Counselor Portal (Desktop) <---> ARISE Core API Layer <---> Database / Cache
- Registrar Portal (Desktop) <---> ARISE Core API Layer <---> External SIS / Audit Store
- Dean Portal (Desktop) <---> ARISE Core API Layer <---> Analytics Engine

External Systems:
- External SIS: Read rosters and grades; write back final faculty grade submissions.
- External Financial System: Read-only binary hold status (1 = Hold, 0 = No Hold).
- External SMS Gateway: Publish critical push fallback notices.

2.2 Product Functionality Summary

Portal: Student
Primary Function: Visibility into academic status, attendance thresholds, confidential help-seeking, and messaging.

Portal: Faculty
Primary Function: Fast roster attendance logging (online/offline), grade encoding, automated alert triggers, and counselor referrals.

Portal: Counselor
Primary Function: Proactive caseload management driven by weekly risk delta digests, case tracking, and outreach messaging.

Portal: Registrar
Primary Function: Institutional data validation, RBAC privilege enforcement, audit trail verification, and record search.

Portal: Dean
Primary Function: College-level anomaly alerts, section failure heatmaps, and capacity/tutor allocation modeling.

2.3 User Classes and Characteristics

User Class: Student
Proficiency: Moderate
Device: Mobile (Android-first)
Constraints: Low/intermittent bandwidth; high reluctance to seek help (hiya).

User Class: Faculty
Proficiency: Low to Moderate
Device: Mobile + Desktop
Constraints: High teaching load; strict requirement for <= 2 min attendance encoding.

User Class: Counselor
Proficiency: Moderate
Device: Desktop
Constraints: High caseloads (~300+ students); requires prioritized risk delta lists.

User Class: Registrar
Proficiency: Moderate to High
Device: Desktop
Constraints: Requires absolute data precision, transactional safety, and legal auditability.

User Class: Dean
Proficiency: Moderate
Device: Desktop
Constraints: Demands aggregated real-time summaries rather than granular raw data tables.

2.4 Operating Environment
- Client Interface: Responsive web application (mobile viewport >= 360px, desktop viewport >= 1024px).
- Supported Browsers: Latest 2 major versions of Chrome, Safari, Firefox, and Edge.
- Connectivity Profile: Optimized for low-bandwidth 3G connections (<= 512 kbps upload/download latency profile).

2.5 Design and Implementation Constraints
- Legal Constraint: Strict compliance with RA 10173. Sensitive Personal Information (SPI) processing requires explicit consent.
- Financial Data Isolation: Financial records in ARISE must remain strictly binary (hold / no-hold). Monetary amounts shall never be ingested or rendered.
- Performance Benchmark: Faculty attendance input for a 40-student roster shall require <= 2 minutes of user interaction time.

2.6 Assumptions and Dependencies
- SIS Integration: The institution maintains a canonical SIS providing roster and course structure data.
- Financial Integration: The financial system exposes an endpoint or view returning student ID and binary hold status.
- Identity Key: Institutional Student ID numbers serve as the immutable primary key for RBAC and cross-system correlation.


===============================================================================
3. SYSTEM MODELING
===============================================================================

3.1 Gane-Sarson Data Flow Diagrams (DFD)

3.1.1 Level 0 Context Diagram

External Entity: Student Information System (SIS)
- Reads: Course Rosters, Prelim/Midterm/Final Grades
- Writes: Submitted Final Grade Records (FAC-FR-010)

External Entity: Financial System
- Reads: Binary Hold Status (Read-Only)

External Entity: SMS Gateway
- Writes: Fallback SMS Alerts

Internal Process: 0.0 ARISE System

External Entity: Student
- Sends: Support Flags, Consent State, Policy Acknowledgments
- Receives: Status Orbs, Attendance Usage, Nudge Messages

External Entity: Faculty
- Sends: Attendance Records, Grade Drafts, Counselor Referrals
- Receives: At-Risk Alerts, Student Profiles, Referral Tracking Status

External Entity: Guidance Counselor
- Sends: Case Updates, Intervention Notes, Warm Nudges
- Receives: Weekly Delta Digests, Student Profiles, Support Queue

External Entity: Registrar
- Sends: RBAC Permissions, Data Discrepancy Resolutions
- Receives: Consolidated Records, Immutable Access Logs, Generated Reports

3.1.2 Level 1 DFD: Subsystem Process Decomposition

Process 1.0: Record & Validate Academic Data
- Ingests attendance/grade inputs from Faculty or offline sync packets.
- Executes schema validation and Last-Write-Wins (LWW) timestamp clock resolution.
- Writes to Data Store D1 (Attendance & Grade Records) and Data Store D2 (Student Master & Roster Store).

Process 2.0: Evaluate Risk Intelligence
- Reads Data Store D1 and D2.
- Calculates absence percentage against threshold parameters.
- Computes PH grade trends (Prelim -> Midterm -> Final) and handles INC/DRP logic.
- Writes generated risk signals to Data Store D3 (Risk Signals & Delta Store).

Process 3.0: Process Interventions & Nudges
- Reads Data Store D3.
- Compiles weekly prioritized delta digests for Counselors.
- Receives support flags from Students and referrals from Faculty.
- Writes intervention records and thread logs to Data Store D4 (Intervention & Message Store).

Process 4.0: Generate Analytics & Audits
- Reads Data Stores D1, D2, D3, and D4.
- Compiles section failure heatmaps, program-level retention reports, and anomaly alerts for Deans.
- Records all read/write/export events into Data Store D5 (System Audit & Access Logs).


3.2 UML Use Case Specifications

3.2.1 Use Case UC-FAC-007: Refer At-Risk Student to Guidance Counselor

Primary Actor: Faculty Member
Secondary Actors: Guidance Counselor, Notification Subsystem
Description: Enables a faculty member to initiate a formal intervention request for an at-risk student directly from the alert view.

Pre-Conditions:
1. Faculty member is authenticated with active session permissions for the course section.
2. Student has an active risk flag (Attendance >= 75% or Declining Grade Trend).

Main Success Scenario:
1. Faculty navigates to the Section Alert View.
2. System renders flagged students alongside their cross-subject risk indicators (FAC-FR-006).
3. Faculty selects "Refer to Counselor" for a specific student.
4. System opens a referral modal prompting for an optional contextual note.
5. Faculty enters an optional note and confirms submission.
6. System creates a new case in the Counselor Case Management queue (CNS-FR-005) in status Pending.
7. System dispatches a push notification to the assigned counselor.
8. System updates the referral tracking status on the faculty interface to Pending (FAC-FR-011).

Extensions (Exceptional Flows):
3a. Faculty selects "I'll Handle It" (FAC-FR-008):
    1. System prompts faculty for an optional internal handling strategy note.
    2. Faculty confirms action.
    3. System suppresses the alert from the active alert queue without dispatching a referral to the counselor.
    4. System logs the action in the Audit Store (D5).
6a. Student has no assigned counselor in the system:
    1. System assigns the referral case to the central OSAS Counselor Queue.
    2. System alerts the Registrar / OSAS Administrator to assign a designated counselor.


3.2.2 Use Case UC-STU-007: Send Confidential Support Signal

Primary Actor: Student
Secondary Actor: Assigned Guidance Counselor
Description: Provides a low-friction mechanism for a student to express a need for assistance without requiring mandatory detailed explanations.

Pre-Conditions:
1. Student is authenticated on the Mobile/Web Student Portal.
2. Student has completed the mandatory Data Privacy Consent flow (STU-FR-011).

Main Success Scenario:
1. Student taps the "I Need Support" primary action button on their dashboard.
2. System displays a confirmation dialog reiterating privacy terms ("Your assigned counselor will receive a confidential notification to reach out to you").
3. Student confirms submission.
4. System generates a confidential support flag in the assigned counselor's queue (CNS-FR-009).
5. System sends an automated, non-intrusive acknowledgment to the student: "Your request has been sent. Your counselor will reach out via a warm nudge."

Extensions (Exceptional Flows):
1a. Student has not granted Data Privacy Consent:
    1. System intercepts the action and renders the Data Privacy Notice (STU-FR-011).
    2. Student reviews and accepts consent.
    3. System proceeds to Step 2 of the main scenario.


===============================================================================
4. SYSTEM REQUIREMENTS
===============================================================================

4.1 External Interface Requirements

4.1.1 User Interfaces
UI-01: Responsive web interface adapting to viewports >= 360px (mobile) and >= 1024px (desktop).
UI-02: Student Dashboard Visual Indicator: A semantic "Status Orb" shall serve as the visual center point:
- Green (#2E7D32): On Track.
- Amber (#EF6C00): At-Risk (>= 75% absence threshold OR declining grade trend).
- Red (#C62828): Critical (100% absence threshold OR cross-subject failure).

4.1.2 Software & System Interfaces
SI-01 (SIS Interface): Ingest student rosters, course structures, prelim/midterm/final grades via TLS 1.3 REST API or scheduled CSV sync. Write back final approved grades from Faculty portal.
SI-02 (Financial System Interface): Ingest binary hold status (1 = Hold Active, 0 = No Hold) mapped to Student ID. Monetary balances shall remain unexposed.
SI-03 (SMS Gateway Interface): Fallback API connection (HTTPS POST) to dispatch critical attendance warnings when push notifications fail delivery after 15 minutes.


4.2 Functional Requirements

4.2.1 Student Portal

STU-FR-001 [Priority: Must]
The system shall display a single-glance semantic status indicator (Green/Amber/Red "Status Orb") on the student dashboard based on §4.2.3 risk rules.

STU-FR-002 [Priority: Must]
The system shall display per enrolled subject: total absences used, remaining allowable absences, and a percentage progress bar toward the failure threshold.

STU-FR-003 [Priority: Must]
The system shall dispatch a push notification (and SMS fallback) when a student reaches their second-to-last allowable absence in any subject.

STU-FR-004 [Priority: Must]
The system shall display session-by-session attendance history filterable by subject, including session date, session type (lecture/lab), and status (Present, Absent, Late).

STU-FR-005 [Priority: Must]
The system shall display current and historical grades per subject with directional trend indicators (Improving, Declining, Stable).

STU-FR-006 [Priority: Must]
The system shall enforce a mandatory modal prompt requiring students to acknowledge each subject's attendance policy at the start of each academic term.

STU-FR-007 [Priority: Must]
The system shall provide a single-tap "I Need Support" action button that sends a confidential support flag to the student's assigned counselor without requiring a mandatory textual explanation.

STU-FR-008 [Priority: Must]
The system shall provide a bidirectional direct messaging channel between the student and their assigned counselor, maintaining message history.

STU-FR-009 [Priority: Must]
The system shall display the assigned counselor's name, office location, consultation hours, and official institutional contact details.

STU-FR-010 [Priority: Must]
The system shall notify students of their full-semester academic standing (grades, active financial holds, unresolved INC marks) at least 5 days prior to the opening of formal enrollment.

STU-FR-011 [Priority: Must]
The system shall capture and store explicit Data Privacy Act (RA 10173) consent from the student during initial portal login before processing cross-departmental records.


4.2.2 Faculty Portal

FAC-FR-001 [Priority: Must]
The system shall allow faculty to mark attendance for an entire section roster via one-tap Present / Absent / Late controls, completable in <= 2 minutes for a 40-student roster.

FAC-FR-002 [Priority: Should]
The system should generate session-specific, time-limited QR codes (<= 120 seconds expiry) for student self-check-in, requiring faculty confirmation.

FAC-FR-003 [Priority: Must]
The system shall store recorded attendance locally on the client device when offline and automatically synchronize data to the server upon reconnection, using a Last-Write-Wins (LWW) vector clock algorithm to resolve write collisions without data loss.

FAC-FR-004 [Priority: Should]
The system should support bulk attendance and grade importing via Excel/CSV files structured according to the system schema (Student_ID, Subject_Code, Date, Status).

FAC-FR-005 [Priority: Must]
The system shall automatically flag students meeting risk thresholds (§4.2.3) directly on the faculty class roster without requiring manual review.

FAC-FR-006 [Priority: Must]
The system shall display a cross-subject risk indicator alongside any flagged student if that student is currently at-risk or critical in >= 2 subjects.

FAC-FR-007 [Priority: Must]
The system shall allow faculty to refer a flagged student to the Guidance Counselor with an optional contextual note in a single interaction flow.

FAC-FR-008 [Priority: Must]
The system shall allow faculty to mark an alert as "I'll Handle It", removing it from active alert queues and logging an internal handling entry.

FAC-FR-009 [Priority: Must]
The system shall support grade entry for Prelim, Midterm, and Final grading periods, including an INC checkbox that disables numeric input and flags an incomplete status.

FAC-FR-010 [Priority: Should]
The system should allow faculty to save grade entries as local/remote drafts prior to formal lock and submission to the Registrar.

FAC-FR-011 [Priority: Must]
The system shall display current tracking status (Pending, Contacted, Resolved) and counselor feedback notes for all referrals initiated by the faculty member.


4.2.3 Risk Detection & Calculation Engine (Rule-Based v1.1)

Risk computation shall be governed by configurable parameters applied against raw attendance, numeric grades, and administrative marks:

Signal: Attendance Warning
Threshold: >= 75% of allowable absences used in any single subject.
Target Status: At Risk (Amber)

Signal: Attendance Critical
Threshold: 100% of allowable absences reached in any single subject.
Target Status: Critical (Red)

Signal: Numeric Grade Trend
Threshold: Midterm grade numerically worse than Prelim grade on PH 1.0 - 5.0 scale (1.0 = Best, 5.0 = Fail). Example: Prelim 1.75 -> Midterm 2.50.
Target Status: Declining Flag

Signal: Administrative Mark (INC)
Threshold: Unresolved INC mark remaining within 30 days of the next enrollment term.
Target Status: Academic Hold Flag

Signal: Administrative Mark (DRP)
Threshold: Official DRP status recorded in >= 1 subjects.
Target Status: Critical (Red)

Signal: Cross-Subject Risk
Threshold: Student triggers Amber or Red flags in >= 2 subjects simultaneously.
Target Status: Cross-Subject Indicator Visible

Signal: Counselor Delta Digest
Threshold: Any negative transition in risk signals over a rolling 7-day window.
Target Status: Surfaced in Weekly Counselor Digest (Ranked by Delta Magnitude)


4.2.4 Guidance Counselor Portal

CNS-FR-001 [Priority: Must]
The system shall generate a weekly ranked digest of advisees experiencing the most negative risk score changes over the prior 7 days.

CNS-FR-002 [Priority: Must]
The system shall provide a searchable, filterable list of all advisees by name, ID, risk level, program, and year level.

CNS-FR-003 [Priority: Must]
The system shall display a consolidated student profile combining GWA, total cross-subject absences, binary financial hold status, subject attendance logs, risk trends over time, and historical intervention logs.

CNS-FR-004 [Priority: Must]
The system shall allow counselors to log timestamped, attributed free-text intervention notes against a student's profile.

CNS-FR-005 [Priority: Must]
The system shall provide a case management view (Kanban or list) tracking statuses: Contacted, Responded, Resolved, and support state transitions.

CNS-FR-006 [Priority: Must]
The system shall allow counselors to schedule follow-up reminders against a case and dispatch system notifications when due.

CNS-FR-007 [Priority: Should]
The system should provide pre-written, editable "warm nudge" message templates for supportive outreach.

CNS-FR-008 [Priority: Must]
The system shall maintain a secure, per-student direct communication thread accessible from both counselor and student portals.

CNS-FR-009 [Priority: Must]
The system shall present confidential student support signals (from STU-FR-007) in a dedicated queue with direct warm nudge response actions.

CNS-FR-010 [Priority: Must]
The system shall track and display whether an intervened student successfully re-enrolled in the subsequent academic term.

CNS-FR-011 [Priority: Should]
The system should compute and display the aggregate intervention success rate (percentage of intervened students who re-enrolled) across terms.


4.2.5 Registrar Portal

REG-FR-001 [Priority: Must]
The system shall provide global search across all student records returning consolidated academic, attendance, and binary financial hold data.

REG-FR-002 [Priority: Must]
The system shall display each student's historical enrollment history and active administrative holds.

REG-FR-003 [Priority: Must]
The system shall automatically detect and queue data inconsistencies (name mismatches, duplicate IDs, missing cross-system links) for review during data ingestion.

REG-FR-004 [Priority: Must]
The system shall allow the registrar to resolve or merge flagged data inconsistencies, recording resolution events in an audit log.

REG-FR-005 [Priority: Must]
The system shall generate on-demand reports: Retention Report, Failure-Rate-by-Subject/Program, At-Risk Summary, and Attendance Summary.

REG-FR-006 [Priority: Must]
The system shall support exporting generated reports to PDF, Excel (XLSX), and CSV formats.

REG-FR-007 [Priority: Should]
The system should support scheduling recurring automatic report generation and email/portal delivery.

REG-FR-008 [Priority: Must]
The system shall provide a Role-Based Access Control (RBAC) permission interface allowing the registrar to grant or revoke read/write access per role for grades and attendance, and strictly READ-ONLY permission controls for financial hold indicators.

REG-FR-009 [Priority: Must]
The system shall maintain an immutable, write-once access log recording user ID, action, target student ID, and UTC timestamp whenever student PII/SPI is accessed or exported.


4.2.6 Dean / Academic Administrator Portal

DEA-FR-001 [Priority: Must]
The system shall display a real-time count of at-risk students broken down by program, updated at least daily.

DEA-FR-002 [Priority: Must]
The system shall display section-level attendance trends aggregated weekly over time.

DEA-FR-003 [Priority: Must]
The system shall display a failure-rate heatmap categorized by subject and section for current grading periods.

DEA-FR-004 [Priority: Must]
The system shall automatically raise an anomaly alert when a section's failure rate exceeds a configurable multiple of the college average.

DEA-FR-005 [Priority: Must]
The system shall automatically raise an anomaly alert when college-wide or section-wide attendance declines for a configurable number of consecutive weeks.

DEA-FR-006 [Priority: Must]
The system shall maintain a historical ledger of anomaly alerts and their resolution/acknowledgment status.

DEA-FR-007 [Priority: Must]
The system shall display semester-over-semester retention rates, dropout counts by program and year level, and risk-to-dropout conversion metrics.

DEA-FR-008 [Priority: Must]
The system shall display at-risk student counts by subject to support academic resource allocation and allow the dean to record peer tutor assignments.

DEA-FR-009 [Priority: Should]
The system should display counselor caseload counts and capacity metrics across all college counselors.

DEA-FR-010 [Priority: Must]
The system shall auto-compile a college performance report supporting PDF export and program-level trend data extraction.


4.3 Non-Functional Requirements

4.3.1 Performance & Scalability
NFR-PERF-001: Faculty attendance submission for a 40-student roster shall complete within <= 2 minutes of active user interaction time.
NFR-PERF-002: Dashboard views shall achieve complete DOM rendering within <= 2 seconds on a 3G-equivalent connection (>= 95th percentile).
NFR-PERF-003: Offline-recorded attendance data shall complete background synchronization within <= 30 seconds upon restoration of connectivity.

4.3.2 Security, Privacy, and Auditability
NFR-SEC-001: All data in transit shall be encrypted using TLS 1.3 (TLS 1.2 minimum fallback). Data at rest shall be encrypted via AES-256.
NFR-SEC-002: Access to student data shall be strictly governed by RBAC enforced per permission matrices managed in REG-FR-008.
NFR-SEC-003: The system shall comply with RA 10173 data minimization requirements. Financial data rendered to non-registrar roles shall remain limited to a binary hold status flag.
NFR-SEC-004: All access to individual student records shall be logged per REG-FR-009 and retained in an append-only audit log for a minimum of 1 academic year.
NFR-SEC-005: Confidential support flags (STU-FR-007) shall isolate student identity visibility exclusively to the assigned counselor's response queue and shall not expose identity across public UI dashboards.

4.3.3 Usability and Accessibility
NFR-UX-001: All interactive components shall satisfy W3C WCAG 2.1 Level AA color contrast requirements (minimum 4.5:1 ratio).
NFR-UX-002: Icon-only controls shall provide accessible labels (aria-label attributes).
NFR-UX-003: The user interface shall respect OS-level reduced motion settings for animations.
NFR-UX-004: The Student portal shall avoid unexplained academic jargon, utilizing explicit legends for grade scales and attendance rules.
NFR-UX-005: All primary user workflows shall be operable via keyboard navigation.

4.3.4 Reliability & Data Resiliency
NFR-REL-001: The system shall maintain 99.5% service availability during active academic terms, excluding announced maintenance windows.
NFR-REL-002: Zero attendance or grade data entered locally by faculty shall be lost during network interruptions, backed by IndexedDB persistent caching and LWW reconciliation.

4.3.5 Maintainability & Architectural Pluggability
NFR-MAINT-001: Risk engine thresholds (§4.2.3) shall be configurable via administrative database settings without requiring application code deployments.
NFR-MAINT-002: System architecture shall isolate the risk detection engine behind a defined API interface, enabling drop-in replacement of rule-based logic with Machine Learning predictive models without altering portal UI layers.


===============================================================================
5. VERIFICATION & ACCEPTANCE CRITERIA
===============================================================================

Verification Methods:
- Inspection: Document, UI layout, WCAG accessibility, and design review.
- Demonstration: Operational walk-through of end-to-end workflows.
- Test (Automated): Unit, integration, load, security, and offline regression testing.
- Analysis: Code execution profiling, telemetry review, and data flow validation.

Acceptance Test Sample 1 (STU-FR-003 / FAC-FR-001):
- Given: A student with 3 used absences in a course with a 4-absence failure limit.
- When: The faculty member logs a 4th absence offline and reconnects to sync data.
- Then: The system reconciles the data within 30 seconds and dispatches a critical risk push notification (and SMS fallback) to the student within 5 minutes.

Acceptance Test Sample 2 (FAC-FR-003 - Offline LWW Conflict Resolution):
- Given: Faculty updates attendance offline at 10:00:00 UTC (Vector Clock T1).
- When: Registrar updates the same student roster record online at 10:01:00 UTC (Vector Clock T2) before Faculty syncs at 10:02:00 UTC.
- Then: The system compares vector clocks, applies Registrar's update as latest, logs the sync collision in audit log D5, and alerts Faculty of the roster state change.


===============================================================================
6. BIDIRECTIONAL REQUIREMENTS TRACEABILITY MATRIX (RTM)
===============================================================================

Req ID: STU-FR-001
Source Trace: Persona: Renz Villanueva / HMW-01
Use Case ID: UC-STU-001
DFD Element: Process 2.0 / Store D3
Database Entity: student_risk_status
Test Case ID: TC-STU-001

Req ID: STU-FR-003
Source Trace: Persona: Renz Villanueva / HMW-02
Use Case ID: UC-STU-003
DFD Element: Process 2.0 / SMS Gateway
Database Entity: notification_queue
Test Case ID: TC-STU-003

Req ID: STU-FR-007
Source Trace: Persona: Renz Villanueva / HMW-03
Use Case ID: UC-STU-007
DFD Element: Process 3.0 / Store D4
Database Entity: support_signals
Test Case ID: TC-STU-007

Req ID: STU-FR-011
Source Trace: RA 10173 Legal Compliance
Use Case ID: UC-STU-011
DFD Element: Process 1.0 / Store D2
Database Entity: privacy_consents
Test Case ID: TC-STU-011

Req ID: FAC-FR-001
Source Trace: Persona: Prof. Rowena / HMW-05
Use Case ID: UC-FAC-001
DFD Element: Process 1.0 / Store D1
Database Entity: attendance_logs
Test Case ID: TC-FAC-001

Req ID: FAC-FR-003
Source Trace: Persona: Prof. Rowena / HMW-06
Use Case ID: UC-FAC-003
DFD Element: Process 1.0 / Store D1
Database Entity: offline_sync_queue
Test Case ID: TC-FAC-003

Req ID: FAC-FR-007
Source Trace: Persona: Prof. Rowena / HMW-07
Use Case ID: UC-FAC-007
DFD Element: Process 3.0 / Store D4
Database Entity: counselor_referrals
Test Case ID: TC-FAC-007

Req ID: CNS-FR-001
Source Trace: Persona: Counselor Arnel / HMW-09
Use Case ID: UC-CNS-001
DFD Element: Process 3.0 / Store D3
Database Entity: weekly_delta_digests
Test Case ID: TC-CNS-001

Req ID: CNS-FR-003
Source Trace: Persona: Counselor Arnel / HMW-10
Use Case ID: UC-CNS-003
DFD Element: Process 3.0 / Store D1, D2, D3
Database Entity: student_master_view
Test Case ID: TC-CNS-003

Req ID: REG-FR-008
Source Trace: Persona: Registrar Cynthia / HMW-14
Use Case ID: UC-REG-008
DFD Element: Process 4.0 / Store D5
Database Entity: rbac_permissions
Test Case ID: TC-REG-008

Req ID: REG-FR-009
Source Trace: RA 10173 Audit Standard
Use Case ID: UC-REG-009
DFD Element: Process 4.0 / Store D5
Database Entity: immutable_access_logs
Test Case ID: TC-REG-009

Req ID: DEA-FR-003
Source Trace: Persona: Dean Minda / HMW-17
Use Case ID: UC-DEA-003
DFD Element: Process 4.0 / Store D1, D3
Database Entity: section_performance_view
Test Case ID: TC-DEA-003

Req ID: DEA-FR-004
Source Trace: Persona: Dean Minda / HMW-18
Use Case ID: UC-DEA-004
DFD Element: Process 4.0 / Store D3
Database Entity: anomaly_alerts
Test Case ID: TC-DEA-004

END OF SOFTWARE REQUIREMENTS SPECIFICATION