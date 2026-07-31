import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { attendancePolicies, sections } from "./academic";
import {
  caseSource,
  caseStatus,
  consentPurpose,
  consentState,
  notificationChannel,
  notificationStatus,
  referralStatus,
  supportSignalStatus,
} from "./enums";
import { employees, students, userAccounts } from "./identity";
import {
  adminAccess,
  appCounselorRole,
  appFacultyRole,
  appUserRole,
  canAccessCase,
  canAccessThread,
  counselorOwnsEmployee,
  counselorOwnsStudent,
  facultyOwnsStudent,
  serviceAccess,
  userOwnsAccount,
  userOwnsStudent,
} from "./rls";

export const services = pgSchema("services");

export const attendancePolicyAcknowledgments = services.table.withRLS(
  "attendance_policy_acknowledgments",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => attendancePolicies.id, { onDelete: "cascade" }),
    acknowledgedAt: timestamp("acknowledged_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.studentId, t.policyId] }),
    pgPolicy("attendance_policy_ack_student_select", {
      for: "select",
      to: appUserRole,
      using: userOwnsStudent("student_id"),
    }),
    pgPolicy("attendance_policy_ack_student_insert", {
      for: "insert",
      to: appUserRole,
      withCheck: userOwnsStudent("student_id"),
    }),
    serviceAccess(),
    adminAccess(),
  ],
);

export const privacyPolicies = services.table("privacy_policies", {
  id: uuid("id").defaultRandom().primaryKey(),
  version: text("version").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
  supersededAt: timestamp("superseded_at", { withTimezone: true }),
});

export const consentRecords = services.table.withRLS(
  "consent_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    policyId: uuid("policy_id")
      .notNull()
      .references(() => privacyPolicies.id, { onDelete: "restrict" }),
    purpose: consentPurpose("purpose").notNull(),
    state: consentState("state").notNull(),
    capturedAt: timestamp("captured_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (t) => [
    unique("consent_records_student_policy_purpose_key").on(
      t.studentId,
      t.policyId,
      t.purpose,
    ),
    pgPolicy("consent_student_select", {
      for: "select",
      to: appUserRole,
      using: userOwnsStudent("student_id"),
    }),
    pgPolicy("consent_student_insert", {
      for: "insert",
      to: appUserRole,
      withCheck: userOwnsStudent("student_id"),
    }),
    serviceAccess(),
    adminAccess(),
    check(
      "consent_records_withdrawal_consistency",
      sql`(${t.state} = 'withdrawn') = (${t.withdrawnAt} IS NOT NULL)`,
    ),
  ],
);

export const counselorAssignments = services.table.withRLS(
  "counselor_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    counselorEmployeeId: uuid("counselor_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    effectiveFrom: timestamp("effective_from", {
      withTimezone: true,
    }).notNull(),
    effectiveUntil: timestamp("effective_until", { withTimezone: true }),
    assignedByUserAccountId: uuid("assigned_by_user_account_id")
      .notNull()
      .references(() => userAccounts.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    pgPolicy("counselor_assignment_student_select", {
      for: "select",
      to: appUserRole,
      using: userOwnsStudent("student_id"),
    }),
    pgPolicy("counselor_assignment_counselor_select", {
      for: "select",
      to: appCounselorRole,
      using: counselorOwnsEmployee("counselor_employee_id"),
    }),
    pgPolicy("counselor_assignment_faculty_select", {
      for: "select",
      to: appFacultyRole,
      using: facultyOwnsStudent(t.studentId),
    }),
    serviceAccess(),
    adminAccess(),
    check(
      "counselor_assignments_time_order",
      sql`${t.effectiveUntil} IS NULL OR ${t.effectiveUntil} > ${t.effectiveFrom}`,
    ),
    index("counselor_assignments_student_time_idx").on(
      t.studentId,
      t.effectiveFrom,
    ),
  ],
);

export const supportSignals = services.table.withRLS(
  "support_signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    recipientCounselorEmployeeId: uuid(
      "recipient_counselor_employee_id",
    ).references(() => employees.id, { onDelete: "restrict" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: supportSignalStatus("status").notNull().default("pending"),
    acknowledgmentSentAt: timestamp("acknowledgment_sent_at", {
      withTimezone: true,
    }),
  },
  (t) => [
    pgPolicy("support_signal_student_insert", {
      for: "insert",
      to: appUserRole,
      withCheck: userOwnsStudent("student_id"),
    }),
    pgPolicy("support_signal_student_select", {
      for: "select",
      to: appUserRole,
      using: userOwnsStudent("student_id"),
    }),
    pgPolicy("support_signal_counselor_select", {
      for: "select",
      to: appCounselorRole,
      using: counselorOwnsEmployee("recipient_counselor_employee_id"),
    }),
    serviceAccess(),
    adminAccess(),
    index("support_signals_recipient_status_idx").on(
      t.recipientCounselorEmployeeId,
      t.status,
    ),
  ],
);

export const counselorReferrals = services.table.withRLS(
  "counselor_referrals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    referredByEmployeeId: uuid("referred_by_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "restrict" }),
    contextualNote: text("contextual_note"),
    caseId: uuid("case_id").references(() => cases.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    pgPolicy("counselor_referral_faculty_insert", {
      for: "insert",
      to: appFacultyRole,
      withCheck: sql`nullif(current_setting('app.employee_id', true), '')::uuid = ${t.referredByEmployeeId}
        AND EXISTS (
          SELECT 1
          FROM academic.section_instructors AS si
          WHERE si.section_id = ${t.sectionId}
            AND si.employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
        )
        AND EXISTS (
          SELECT 1
          FROM academic.enrollments AS e
          WHERE e.section_id = ${t.sectionId}
            AND e.student_id = ${t.studentId}
            AND e.status = 'enrolled'
        )`,
    }),
    pgPolicy("counselor_referral_faculty_select", {
      for: "select",
      to: appFacultyRole,
      using: sql`nullif(current_setting('app.employee_id', true), '')::uuid = ${t.referredByEmployeeId}`,
    }),
    pgPolicy("counselor_referral_faculty_update", {
      for: "update",
      to: appFacultyRole,
      using: sql`nullif(current_setting('app.employee_id', true), '')::uuid = ${t.referredByEmployeeId}`,
      withCheck: sql`nullif(current_setting('app.employee_id', true), '')::uuid = ${t.referredByEmployeeId}`,
    }),
    pgPolicy("counselor_referral_counselor_select", {
      for: "select",
      to: appCounselorRole,
      using: counselorOwnsStudent(t.studentId),
    }),
    serviceAccess(),
    adminAccess(),
    index("counselor_referrals_student_idx").on(t.studentId),
  ],
);

export const referralStatusHistory = services.table.withRLS(
  "referral_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    referralId: uuid("referral_id")
      .notNull()
      .references(() => counselorReferrals.id, { onDelete: "cascade" }),
    status: referralStatus("status").notNull(),
    changedByEmployeeId: uuid("changed_by_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    feedbackNote: text("feedback_note"),
  },
  (t) => [
    pgPolicy("referral_status_faculty_select", {
      for: "select",
      to: appFacultyRole,
      using: sql`EXISTS (
        SELECT 1
        FROM services.counselor_referrals AS cr
        WHERE cr.id = ${t.referralId}
          AND cr.referred_by_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      )`,
    }),
    pgPolicy("referral_status_counselor_select", {
      for: "select",
      to: appCounselorRole,
      using: sql`EXISTS (
        SELECT 1
        FROM services.counselor_referrals AS cr
        JOIN services.counselor_assignments AS ca ON ca.student_id = cr.student_id
        WHERE cr.id = ${t.referralId}
          AND ca.counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
          AND ca.effective_from <= now()
          AND (ca.effective_until IS NULL OR ca.effective_until > now())
      )`,
    }),
    pgPolicy("referral_status_faculty_insert", {
      for: "insert",
      to: appFacultyRole,
      withCheck: sql`EXISTS (
        SELECT 1
        FROM services.counselor_referrals AS cr
        WHERE cr.id = ${t.referralId}
          AND cr.referred_by_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      )
      AND ${t.changedByEmployeeId} = nullif(current_setting('app.employee_id', true), '')::uuid`,
    }),
    pgPolicy("referral_status_counselor_insert", {
      for: "insert",
      to: appCounselorRole,
      withCheck: sql`EXISTS (
        SELECT 1
        FROM services.counselor_referrals AS cr
        WHERE cr.id = ${t.referralId}
          AND ${counselorOwnsStudent(sql`cr.student_id`)}
      )
      AND ${t.changedByEmployeeId} = nullif(current_setting('app.employee_id', true), '')::uuid`,
    }),
    serviceAccess(),
    adminAccess(),
    index("referral_status_history_referral_idx").on(t.referralId, t.changedAt),
  ],
);

export const cases = services.table.withRLS(
  "cases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    assignedCounselorEmployeeId: uuid(
      "assigned_counselor_employee_id",
    ).references(() => employees.id, { onDelete: "restrict" }),
    source: caseSource("source").notNull(),
    sourceSupportSignalId: uuid("source_support_signal_id")
      .references(() => supportSignals.id, { onDelete: "restrict" })
      .unique(),
    openedAt: timestamp("opened_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    pgPolicy("case_student_select", {
      for: "select",
      to: appUserRole,
      using: userOwnsStudent("student_id"),
    }),
    pgPolicy("case_counselor_select", {
      for: "select",
      to: appCounselorRole,
      using: counselorOwnsEmployee("assigned_counselor_employee_id"),
    }),
    pgPolicy("case_student_insert", {
      for: "insert",
      to: appUserRole,
      withCheck: sql`${t.source} = 'support_signal'
        AND ${t.sourceSupportSignalId} IS NOT NULL
        AND ${t.studentId} = nullif(current_setting('app.student_id', true), '')::uuid
        AND EXISTS (
          SELECT 1
          FROM services.support_signals AS ss
          WHERE ss.id = ${t.sourceSupportSignalId}
            AND ss.student_id = ${t.studentId}
            AND ss.recipient_counselor_employee_id = ${t.assignedCounselorEmployeeId}
        )`,
    }),
    pgPolicy("case_faculty_insert", {
      for: "insert",
      to: appFacultyRole,
      withCheck: sql`${t.source} = 'faculty_referral'
        AND ${t.sourceSupportSignalId} IS NULL
        AND EXISTS (
          SELECT 1
          FROM services.counselor_referrals AS cr
          WHERE cr.student_id = ${t.studentId}
            AND cr.referred_by_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
            AND cr.case_id IS NULL
        )
        AND EXISTS (
          SELECT 1
          FROM services.counselor_assignments AS ca
          WHERE ca.student_id = ${t.studentId}
            AND ca.counselor_employee_id = ${t.assignedCounselorEmployeeId}
            AND ca.effective_from <= now()
            AND (ca.effective_until IS NULL OR ca.effective_until > now())
        )`,
    }),
    serviceAccess(),
    adminAccess(),
    check(
      "cases_support_signal_source_consistency",
      sql`(${t.source} = 'support_signal') = (${t.sourceSupportSignalId} IS NOT NULL)`,
    ),
    index("cases_student_id_idx").on(t.studentId),
  ],
);

export const caseStatusHistory = services.table.withRLS(
  "case_status_history",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    status: caseStatus("status").notNull(),
    changedByEmployeeId: uuid("changed_by_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    changedAt: timestamp("changed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    note: text("note"),
  },
  (t) => [
    pgPolicy("case_status_counselor_select", {
      for: "select",
      to: appCounselorRole,
      using: canAccessCase(t.caseId),
    }),
    pgPolicy("case_status_student_insert", {
      for: "insert",
      to: appUserRole,
      withCheck: sql`${t.status} = 'pending'
        AND ${t.changedByEmployeeId} = (
          SELECT c.assigned_counselor_employee_id
          FROM services.cases AS c
          WHERE c.id = ${t.caseId}
            AND c.student_id = nullif(current_setting('app.student_id', true), '')::uuid
            AND c.source = 'support_signal'
        )`,
    }),
    pgPolicy("case_status_faculty_insert", {
      for: "insert",
      to: appFacultyRole,
      withCheck: sql`${t.status} = 'pending'
        AND ${t.changedByEmployeeId} = (
          SELECT ca.counselor_employee_id
          FROM services.counselor_referrals AS cr
          JOIN services.counselor_assignments AS ca ON ca.student_id = cr.student_id
          WHERE cr.case_id = ${t.caseId}
            AND cr.referred_by_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
            AND ca.effective_from <= now()
            AND (ca.effective_until IS NULL OR ca.effective_until > now())
          ORDER BY ca.effective_from DESC
          LIMIT 1
        )`,
    }),
    pgPolicy("case_status_counselor_insert", {
      for: "insert",
      to: appCounselorRole,
      withCheck: sql`${canAccessCase(t.caseId)}
        AND ${t.changedByEmployeeId} = nullif(current_setting('app.employee_id', true), '')::uuid`,
    }),
    serviceAccess(),
    adminAccess(),
    index("case_status_history_case_time_idx").on(t.caseId, t.changedAt),
  ],
);

export const interventionNotes = services.table.withRLS(
  "intervention_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    authorEmployeeId: uuid("author_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    note: text("note").notNull(),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    pgPolicy("intervention_note_counselor_select", {
      for: "select",
      to: appCounselorRole,
      using: canAccessCase(t.caseId),
    }),
    pgPolicy("intervention_note_counselor_insert", {
      for: "insert",
      to: appCounselorRole,
      withCheck: sql`${canAccessCase(t.caseId)}
        AND ${t.authorEmployeeId} = nullif(current_setting('app.employee_id', true), '')::uuid`,
    }),
    serviceAccess(),
    adminAccess(),
    check(
      "intervention_notes_not_blank",
      sql`char_length(trim(${t.note})) > 0`,
    ),
  ],
);

export const followUpReminders = services.table.withRLS(
  "follow_up_reminders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id, { onDelete: "cascade" }),
    assignedToEmployeeId: uuid("assigned_to_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    pgPolicy("follow_up_counselor_select", {
      for: "select",
      to: appCounselorRole,
      using: canAccessCase(t.caseId),
    }),
    serviceAccess(),
    adminAccess(),
    check(
      "follow_up_reminders_completion_order",
      sql`${t.completedAt} IS NULL OR ${t.completedAt} >= ${t.dueAt}`,
    ),
  ],
);

export const messageThreads = services.table.withRLS(
  "message_threads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    counselorEmployeeId: uuid("counselor_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("message_threads_student_counselor_key").on(
      t.studentId,
      t.counselorEmployeeId,
    ),
    pgPolicy("message_thread_student_select", {
      for: "select",
      to: appUserRole,
      using: userOwnsStudent("student_id"),
    }),
    pgPolicy("message_thread_student_insert", {
      for: "insert",
      to: appUserRole,
      withCheck: userOwnsStudent("student_id"),
    }),
    pgPolicy("message_thread_counselor_select", {
      for: "select",
      to: appCounselorRole,
      using: counselorOwnsEmployee("counselor_employee_id"),
    }),
    serviceAccess(),
    adminAccess(),
  ],
);

export const messages = services.table.withRLS(
  "messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => messageThreads.id, { onDelete: "cascade" }),
    sequence: integer("sequence").notNull(),
    senderUserAccountId: uuid("sender_user_account_id")
      .notNull()
      .references(() => userAccounts.id, { onDelete: "restrict" }),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).notNull().defaultNow(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [
    unique("messages_thread_sequence_key").on(t.threadId, t.sequence),
    pgPolicy("message_thread_student_messages", {
      for: "select",
      to: appUserRole,
      using: canAccessThread(t.threadId),
    }),
    pgPolicy("message_thread_student_messages_insert", {
      for: "insert",
      to: appUserRole,
      withCheck: sql`${canAccessThread(t.threadId)} AND nullif(current_setting('app.user_account_id', true), '')::uuid = ${t.senderUserAccountId}`,
    }),
    pgPolicy("message_thread_counselor_messages", {
      for: "select",
      to: appCounselorRole,
      using: canAccessThread(t.threadId),
    }),
    pgPolicy("message_thread_counselor_messages_insert", {
      for: "insert",
      to: appCounselorRole,
      withCheck: sql`${canAccessThread(t.threadId)} AND nullif(current_setting('app.user_account_id', true), '')::uuid = ${t.senderUserAccountId}`,
    }),
    serviceAccess(),
    adminAccess(),
    check("messages_body_not_blank", sql`char_length(trim(${t.body})) > 0`),
  ],
);

export const notifications = services.table.withRLS(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    recipientUserAccountId: uuid("recipient_user_account_id")
      .notNull()
      .references(() => userAccounts.id, { onDelete: "cascade" }),
    studentId: uuid("student_id").references(() => students.id, {
      onDelete: "cascade",
    }),
    channel: notificationChannel("channel").notNull(),
    status: notificationStatus("status").notNull().default("queued"),
    queuedAt: timestamp("queued_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    pgPolicy("notification_recipient_select", {
      for: "select",
      to: appUserRole,
      using: userOwnsAccount("recipient_user_account_id"),
    }),
    serviceAccess(),
    adminAccess(),
    check(
      "notifications_delivery_consistency",
      sql`(${t.status} = 'delivered') = (${t.deliveredAt} IS NOT NULL)`,
    ),
    index("notifications_recipient_status_idx").on(
      t.recipientUserAccountId,
      t.status,
    ),
  ],
);
