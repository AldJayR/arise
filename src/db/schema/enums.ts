import { pgSchema } from "drizzle-orm/pg-core";

export const common = pgSchema("common");

export const personStatus = common.enum("person_status", [
  "active",
  "inactive",
]);
export const accountStatus = common.enum("account_status", [
  "active",
  "locked",
  "disabled",
]);
export const employmentStatus = common.enum("employment_status", [
  "active",
  "inactive",
]);
export const termKind = common.enum("term_kind", [
  "first_semester",
  "second_semester",
  "summer",
]);
export const enrollmentStatus = common.enum("enrollment_status", [
  "enrolled",
  "dropped",
  "completed",
  "withdrawn",
]);
export const sectionStatus = common.enum("section_status", [
  "planned",
  "open",
  "closed",
  "cancelled",
]);
export const assignmentRole = common.enum("assignment_role", [
  "primary",
  "co_instructor",
]);
export const sessionType = common.enum("session_type", ["lecture", "lab"]);
export const attendanceStatus = common.enum("attendance_status", [
  "present",
  "absent",
  "late",
  "excused",
]);
export const attendanceSource = common.enum("attendance_source", [
  "faculty",
  "qr_check_in",
  "import",
  "offline_sync",
]);
export const gradePeriodKind = common.enum("grade_period_kind", [
  "prelim",
  "midterm",
  "final",
]);
export const gradeMarkKind = common.enum("grade_mark_kind", [
  "numeric",
  "inc",
  "drp",
  "pass",
  "fail",
]);
export const consentPurpose = common.enum("consent_purpose", [
  "cross_departmental_records",
  "confidential_support_signal",
  "direct_counselor_messaging",
]);
export const consentState = common.enum("consent_state", [
  "granted",
  "withdrawn",
]);
export const supportSignalStatus = common.enum("support_signal_status", [
  "pending",
  "acknowledged",
  "closed",
]);
export const caseSource = common.enum("case_source", [
  "support_signal",
  "faculty_referral",
  "risk_digest",
  "manual",
]);
export const caseStatus = common.enum("case_status", [
  "pending",
  "contacted",
  "responded",
  "resolved",
]);
export const referralStatus = common.enum("referral_status", [
  "pending",
  "contacted",
  "resolved",
]);
export const notificationChannel = common.enum("notification_channel", [
  "push",
  "sms",
  "email",
  "portal",
]);
export const notificationStatus = common.enum("notification_status", [
  "queued",
  "sent",
  "delivered",
  "failed",
]);
export const riskSeverity = common.enum("risk_severity", ["amber", "red"]);
export const riskRuleType = common.enum("risk_rule_type", [
  "attendance_warning",
  "attendance_critical",
  "numeric_grade_decline",
  "unresolved_inc",
  "drp",
  "cross_subject",
]);
export const thresholdUnit = common.enum("threshold_unit", [
  "percentage",
  "count",
  "days",
  "boolean",
]);
export const syncOperationStatus = common.enum("sync_operation_status", [
  "received",
  "applied",
  "rejected",
  "conflicted",
]);
export const discrepancyStatus = common.enum("discrepancy_status", [
  "open",
  "resolved",
  "dismissed",
]);
export const auditAction = common.enum("audit_action", [
  "read",
  "insert",
  "update",
  "delete",
  "export",
  "sync_conflict",
]);
