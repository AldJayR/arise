CREATE SCHEMA "academic";
--> statement-breakpoint
CREATE SCHEMA "common";
--> statement-breakpoint
CREATE SCHEMA "governance";
--> statement-breakpoint
CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE SCHEMA "integration";
--> statement-breakpoint
CREATE SCHEMA "risk";
--> statement-breakpoint
CREATE SCHEMA "services";
--> statement-breakpoint
CREATE TYPE "common"."account_status" AS ENUM('active', 'locked', 'disabled');--> statement-breakpoint
CREATE TYPE "common"."assignment_role" AS ENUM('primary', 'co_instructor');--> statement-breakpoint
CREATE TYPE "common"."attendance_source" AS ENUM('faculty', 'qr_check_in', 'import', 'offline_sync');--> statement-breakpoint
CREATE TYPE "common"."attendance_status" AS ENUM('present', 'absent', 'late', 'excused');--> statement-breakpoint
CREATE TYPE "common"."audit_action" AS ENUM('read', 'insert', 'update', 'delete', 'export', 'sync_conflict');--> statement-breakpoint
CREATE TYPE "common"."case_source" AS ENUM('support_signal', 'faculty_referral', 'risk_digest', 'manual');--> statement-breakpoint
CREATE TYPE "common"."case_status" AS ENUM('pending', 'contacted', 'responded', 'resolved');--> statement-breakpoint
CREATE TYPE "common"."consent_purpose" AS ENUM('cross_departmental_records', 'confidential_support_signal', 'direct_counselor_messaging');--> statement-breakpoint
CREATE TYPE "common"."consent_state" AS ENUM('granted', 'withdrawn');--> statement-breakpoint
CREATE TYPE "common"."discrepancy_status" AS ENUM('open', 'resolved', 'dismissed');--> statement-breakpoint
CREATE TYPE "common"."employment_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "common"."enrollment_status" AS ENUM('enrolled', 'dropped', 'completed', 'withdrawn');--> statement-breakpoint
CREATE TYPE "common"."grade_mark_kind" AS ENUM('numeric', 'inc', 'drp', 'pass', 'fail');--> statement-breakpoint
CREATE TYPE "common"."grade_period_kind" AS ENUM('prelim', 'midterm', 'final');--> statement-breakpoint
CREATE TYPE "common"."notification_channel" AS ENUM('push', 'sms', 'email', 'portal');--> statement-breakpoint
CREATE TYPE "common"."notification_status" AS ENUM('queued', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "common"."person_status" AS ENUM('active', 'inactive');--> statement-breakpoint
CREATE TYPE "common"."referral_status" AS ENUM('pending', 'contacted', 'resolved');--> statement-breakpoint
CREATE TYPE "common"."risk_rule_type" AS ENUM('attendance_warning', 'attendance_critical', 'numeric_grade_decline', 'unresolved_inc', 'drp', 'cross_subject');--> statement-breakpoint
CREATE TYPE "common"."risk_severity" AS ENUM('amber', 'red');--> statement-breakpoint
CREATE TYPE "common"."section_status" AS ENUM('planned', 'open', 'closed', 'cancelled');--> statement-breakpoint
CREATE TYPE "common"."session_type" AS ENUM('lecture', 'lab');--> statement-breakpoint
CREATE TYPE "common"."support_signal_status" AS ENUM('pending', 'acknowledged', 'closed');--> statement-breakpoint
CREATE TYPE "common"."sync_operation_status" AS ENUM('received', 'applied', 'rejected', 'conflicted');--> statement-breakpoint
CREATE TYPE "common"."term_kind" AS ENUM('first_semester', 'second_semester', 'summer');--> statement-breakpoint
CREATE TYPE "common"."threshold_unit" AS ENUM('percentage', 'count', 'days', 'boolean');--> statement-breakpoint
CREATE ROLE "arise_app_admin" WITH NOINHERIT;--> statement-breakpoint
CREATE ROLE "arise_app_auditor" WITH NOINHERIT;--> statement-breakpoint
CREATE ROLE "arise_app_counselor" WITH NOINHERIT;--> statement-breakpoint
CREATE ROLE "arise_app_dean" WITH NOINHERIT;--> statement-breakpoint
CREATE ROLE "arise_app_faculty" WITH NOINHERIT;--> statement-breakpoint
CREATE ROLE "arise_app_registrar" WITH NOINHERIT;--> statement-breakpoint
CREATE ROLE "arise_app_service" WITH NOINHERIT;--> statement-breakpoint
CREATE ROLE "arise_app_user" WITH NOINHERIT;--> statement-breakpoint
CREATE TABLE "academic"."academic_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL UNIQUE,
	"academic_year" text NOT NULL,
	"kind" "common"."term_kind" NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"enrollment_opens_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academic_terms_date_order" CHECK ("ends_on" > "starts_on")
);
--> statement-breakpoint
CREATE TABLE "academic"."attendance_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"section_id" uuid NOT NULL UNIQUE,
	"policy_version" text NOT NULL,
	"allowable_absences" integer NOT NULL,
	"policy_text" text NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	CONSTRAINT "attendance_policies_allowable_absences_nonnegative" CHECK ("allowable_absences" >= 0)
);
--> statement-breakpoint
CREATE TABLE "academic"."attendance_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"session_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"status" "common"."attendance_status" NOT NULL,
	"source" "common"."attendance_source" NOT NULL,
	"recorded_by_employee_id" uuid,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"client_operation_id" uuid,
	CONSTRAINT "attendance_records_session_enrollment_key" UNIQUE("session_id","enrollment_id")
);
--> statement-breakpoint
ALTER TABLE "academic"."attendance_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "academic"."class_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"section_id" uuid NOT NULL,
	"session_sequence" integer NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"type" "common"."session_type" NOT NULL,
	CONSTRAINT "class_sessions_section_sequence_key" UNIQUE("section_id","session_sequence"),
	CONSTRAINT "class_sessions_sequence_positive" CHECK ("session_sequence" > 0),
	CONSTRAINT "class_sessions_time_order" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at")
);
--> statement-breakpoint
CREATE TABLE "academic"."colleges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL UNIQUE,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic"."courses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"credit_units" numeric(4,2) NOT NULL,
	CONSTRAINT "courses_credit_units_positive" CHECK ("credit_units" > 0)
);
--> statement-breakpoint
CREATE TABLE "academic"."curriculum_courses" (
	"program_id" uuid,
	"course_id" uuid,
	"effective_term_id" uuid,
	"required" boolean DEFAULT true NOT NULL,
	CONSTRAINT "curriculum_courses_pkey" PRIMARY KEY("program_id","course_id","effective_term_id")
);
--> statement-breakpoint
CREATE TABLE "academic"."enrollments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"status" "common"."enrollment_status" DEFAULT 'enrolled'::"common"."enrollment_status" NOT NULL,
	"enrolled_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	CONSTRAINT "enrollments_student_section_key" UNIQUE("student_id","section_id"),
	CONSTRAINT "enrollments_withdrawn_at_consistency" CHECK (("status" = 'withdrawn') = ("withdrawn_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "academic"."enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "academic"."grade_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" "common"."grade_period_kind" NOT NULL UNIQUE,
	"sequence" integer NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "academic"."grade_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"enrollment_id" uuid NOT NULL,
	"grade_period_id" uuid NOT NULL,
	"mark_kind" "common"."grade_mark_kind" NOT NULL,
	"numeric_value" numeric(3,2),
	"submitted_by_employee_id" uuid NOT NULL,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"locked_at" timestamp with time zone,
	CONSTRAINT "grade_records_enrollment_period_key" UNIQUE("enrollment_id","grade_period_id"),
	CONSTRAINT "grade_records_mark_value_consistency" CHECK (("mark_kind" = 'numeric' AND "numeric_value" BETWEEN 1.00 AND 5.00) OR ("mark_kind" <> 'numeric' AND "numeric_value" IS NULL)),
	CONSTRAINT "grade_records_lock_after_submission" CHECK ("locked_at" IS NULL OR "locked_at" >= "submitted_at")
);
--> statement-breakpoint
ALTER TABLE "academic"."grade_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "academic"."programs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"college_id" uuid NOT NULL,
	"code" text NOT NULL UNIQUE,
	"name" text NOT NULL,
	"degree_type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "academic"."section_instructors" (
	"section_id" uuid,
	"employee_id" uuid,
	"role" "common"."assignment_role" NOT NULL,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "section_instructors_pkey" PRIMARY KEY("section_id","employee_id")
);
--> statement-breakpoint
CREATE TABLE "academic"."sections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"course_id" uuid NOT NULL,
	"term_id" uuid NOT NULL,
	"section_code" text NOT NULL,
	"capacity" integer,
	"status" "common"."section_status" DEFAULT 'planned'::"common"."section_status" NOT NULL,
	CONSTRAINT "sections_course_term_code_key" UNIQUE("course_id","term_id","section_code"),
	CONSTRAINT "sections_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0)
);
--> statement-breakpoint
CREATE TABLE "governance"."audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"actor_user_account_id" uuid,
	"target_student_id" uuid,
	"action" "common"."audit_action" NOT NULL,
	"target_schema" text NOT NULL,
	"target_table" text NOT NULL,
	"target_record_id" uuid,
	"request_id" uuid,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"previous_hash" text,
	"event_hash" text NOT NULL,
	"metadata" jsonb NOT NULL,
	CONSTRAINT "audit_events_target_schema_not_blank" CHECK (char_length(trim("target_schema")) > 0),
	CONSTRAINT "audit_events_target_table_not_blank" CHECK (char_length(trim("target_table")) > 0)
);
--> statement-breakpoint
ALTER TABLE "governance"."audit_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "identity"."employees" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"person_id" uuid NOT NULL UNIQUE,
	"employee_number" text NOT NULL UNIQUE,
	"status" "common"."employment_status" DEFAULT 'active'::"common"."employment_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "employees_number_not_blank" CHECK (char_length(trim("employee_number")) > 0)
);
--> statement-breakpoint
ALTER TABLE "identity"."employees" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "identity"."permissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL UNIQUE,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."persons" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"legal_given_name" text NOT NULL,
	"legal_family_name" text NOT NULL,
	"display_name" text NOT NULL,
	"institutional_email" text UNIQUE,
	"phone_e164" text,
	"status" "common"."person_status" DEFAULT 'active'::"common"."person_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "persons_names_not_blank" CHECK (char_length(trim("legal_given_name")) > 0 AND char_length(trim("legal_family_name")) > 0),
	CONSTRAINT "persons_email_lowercase" CHECK ("institutional_email" IS NULL OR "institutional_email" = lower("institutional_email"))
);
--> statement-breakpoint
ALTER TABLE "identity"."persons" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "identity"."role_permissions" (
	"role_id" uuid,
	"permission_id" uuid,
	CONSTRAINT "role_permissions_pkey" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "identity"."roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" text NOT NULL UNIQUE,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity"."students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"person_id" uuid NOT NULL UNIQUE,
	"institutional_student_number" text NOT NULL UNIQUE,
	"admission_date" date,
	"status" "common"."person_status" DEFAULT 'active'::"common"."person_status" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_number_not_blank" CHECK (char_length(trim("institutional_student_number")) > 0)
);
--> statement-breakpoint
ALTER TABLE "identity"."students" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "identity"."user_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"person_id" uuid NOT NULL UNIQUE,
	"authentication_subject" text NOT NULL UNIQUE,
	"status" "common"."account_status" DEFAULT 'active'::"common"."account_status" NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_accounts_subject_not_blank" CHECK (char_length(trim("authentication_subject")) > 0)
);
--> statement-breakpoint
ALTER TABLE "identity"."user_accounts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "identity"."user_roles" (
	"user_account_id" uuid,
	"role_id" uuid,
	"assigned_by_user_account_id" uuid,
	"assigned_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_roles_pkey" PRIMARY KEY("user_account_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "integration"."discrepancy_resolutions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"discrepancy_id" uuid NOT NULL,
	"resolved_by_user_account_id" uuid NOT NULL,
	"resolution" text NOT NULL,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discrepancy_resolutions_not_blank" CHECK (char_length(trim("resolution")) > 0)
);
--> statement-breakpoint
ALTER TABLE "integration"."discrepancy_resolutions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration"."external_student_mappings" (
	"student_id" uuid NOT NULL,
	"source_system" text,
	"external_student_key" text,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "external_student_mappings_pkey" PRIMARY KEY("source_system","external_student_key"),
	CONSTRAINT "external_student_mappings_student_source_key" UNIQUE("student_id","source_system")
);
--> statement-breakpoint
CREATE TABLE "integration"."financial_hold_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"source_system" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"hold_active" boolean NOT NULL,
	CONSTRAINT "financial_hold_snapshots_source_effective_key" UNIQUE("student_id","source_system","effective_at")
);
--> statement-breakpoint
ALTER TABLE "integration"."financial_hold_snapshots" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration"."import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"source_system" text NOT NULL,
	"source_batch_key" text NOT NULL UNIQUE,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "import_batches_source_not_blank" CHECK (char_length(trim("source_system")) > 0)
);
--> statement-breakpoint
CREATE TABLE "integration"."ingestion_discrepancies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"import_batch_id" uuid NOT NULL,
	"discrepancy_type" text NOT NULL,
	"external_key" text NOT NULL,
	"description" text NOT NULL,
	"status" "common"."discrepancy_status" DEFAULT 'open'::"common"."discrepancy_status" NOT NULL,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "integration"."ingestion_discrepancies" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration"."offline_sync_operations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"client_operation_id" uuid NOT NULL UNIQUE,
	"device_id" text NOT NULL,
	"session_id" uuid NOT NULL,
	"enrollment_id" uuid NOT NULL,
	"requested_status" "common"."attendance_status" NOT NULL,
	"vector_clock" jsonb NOT NULL,
	"client_recorded_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "common"."sync_operation_status" DEFAULT 'received'::"common"."sync_operation_status" NOT NULL,
	CONSTRAINT "offline_sync_device_not_blank" CHECK (char_length(trim("device_id")) > 0)
);
--> statement-breakpoint
ALTER TABLE "integration"."offline_sync_operations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "integration"."sync_conflicts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"operation_id" uuid NOT NULL,
	"winning_operation_id" uuid NOT NULL,
	"resolution_reason" text NOT NULL,
	"resolved_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sync_conflicts_operation_winner_key" UNIQUE("operation_id","winning_operation_id"),
	CONSTRAINT "sync_conflicts_distinct_operations" CHECK ("operation_id" <> "winning_operation_id")
);
--> statement-breakpoint
ALTER TABLE "integration"."sync_conflicts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "risk"."risk_evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"evaluated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"engine_version" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "risk"."risk_evaluations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "risk"."risk_rule_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"code" "common"."risk_rule_type" NOT NULL UNIQUE,
	"name" text NOT NULL,
	"description" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk"."risk_rule_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"rule_definition_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"threshold_value" numeric(8,2) NOT NULL,
	"threshold_unit" "common"."threshold_unit" NOT NULL,
	"active_from" timestamp with time zone NOT NULL,
	"active_until" timestamp with time zone,
	CONSTRAINT "risk_rule_versions_definition_version_key" UNIQUE("rule_definition_id","version"),
	CONSTRAINT "risk_rule_versions_time_order" CHECK ("active_until" IS NULL OR "active_until" > "active_from"),
	CONSTRAINT "risk_rule_versions_threshold_nonnegative" CHECK ("threshold_value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "risk"."risk_signal_enrollments" (
	"risk_signal_id" uuid,
	"enrollment_id" uuid,
	CONSTRAINT "risk_signal_enrollments_pkey" PRIMARY KEY("risk_signal_id","enrollment_id")
);
--> statement-breakpoint
ALTER TABLE "risk"."risk_signal_enrollments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "risk"."risk_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"evaluation_id" uuid NOT NULL,
	"rule_version_id" uuid NOT NULL,
	"severity" "common"."risk_severity" NOT NULL,
	"triggered_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "risk"."risk_signals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "risk"."weekly_delta_digest_entries" (
	"digest_id" uuid,
	"student_id" uuid,
	"rank" integer NOT NULL,
	"delta_magnitude" numeric(8,2) NOT NULL,
	CONSTRAINT "weekly_delta_digest_entries_pkey" PRIMARY KEY("digest_id","student_id"),
	CONSTRAINT "weekly_delta_digest_entries_rank_key" UNIQUE("digest_id","rank"),
	CONSTRAINT "weekly_delta_digest_entries_rank_positive" CHECK ("rank" > 0)
);
--> statement-breakpoint
CREATE TABLE "risk"."weekly_delta_digests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"counselor_employee_id" uuid NOT NULL,
	"window_starts_at" timestamp with time zone NOT NULL,
	"window_ends_at" timestamp with time zone NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weekly_delta_digests_counselor_window_key" UNIQUE("counselor_employee_id","window_starts_at","window_ends_at"),
	CONSTRAINT "weekly_delta_digests_window_order" CHECK ("window_ends_at" > "window_starts_at")
);
--> statement-breakpoint
CREATE TABLE "services"."attendance_policy_acknowledgments" (
	"student_id" uuid,
	"policy_id" uuid,
	"acknowledged_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attendance_policy_acknowledgments_pkey" PRIMARY KEY("student_id","policy_id")
);
--> statement-breakpoint
ALTER TABLE "services"."attendance_policy_acknowledgments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services"."case_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"case_id" uuid NOT NULL,
	"status" "common"."case_status" NOT NULL,
	"changed_by_employee_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"note" text
);
--> statement-breakpoint
ALTER TABLE "services"."case_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services"."cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"assigned_counselor_employee_id" uuid,
	"source" "common"."case_source" NOT NULL,
	"source_support_signal_id" uuid UNIQUE,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cases_support_signal_source_consistency" CHECK (("source" = 'support_signal') = ("source_support_signal_id" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "services"."cases" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services"."consent_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"purpose" "common"."consent_purpose" NOT NULL,
	"state" "common"."consent_state" NOT NULL,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	CONSTRAINT "consent_records_student_policy_purpose_key" UNIQUE("student_id","policy_id","purpose"),
	CONSTRAINT "consent_records_withdrawal_consistency" CHECK (("state" = 'withdrawn') = ("withdrawn_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "services"."consent_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services"."counselor_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"counselor_employee_id" uuid NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_until" timestamp with time zone,
	"assigned_by_user_account_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "counselor_assignments_time_order" CHECK ("effective_until" IS NULL OR "effective_until" > "effective_from")
);
--> statement-breakpoint
ALTER TABLE "services"."counselor_assignments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services"."counselor_referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"referred_by_employee_id" uuid NOT NULL,
	"section_id" uuid NOT NULL,
	"contextual_note" text,
	"case_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "services"."counselor_referrals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services"."follow_up_reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"case_id" uuid NOT NULL,
	"assigned_to_employee_id" uuid NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "follow_up_reminders_completion_order" CHECK ("completed_at" IS NULL OR "completed_at" >= "due_at")
);
--> statement-breakpoint
ALTER TABLE "services"."follow_up_reminders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services"."intervention_notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"case_id" uuid NOT NULL,
	"author_employee_id" uuid NOT NULL,
	"note" text NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "intervention_notes_not_blank" CHECK (char_length(trim("note")) > 0)
);
--> statement-breakpoint
ALTER TABLE "services"."intervention_notes" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services"."message_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"counselor_employee_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "message_threads_student_counselor_key" UNIQUE("student_id","counselor_employee_id")
);
--> statement-breakpoint
ALTER TABLE "services"."message_threads" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services"."messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"thread_id" uuid NOT NULL,
	"sequence" integer NOT NULL,
	"sender_user_account_id" uuid NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone,
	CONSTRAINT "messages_thread_sequence_key" UNIQUE("thread_id","sequence"),
	CONSTRAINT "messages_body_not_blank" CHECK (char_length(trim("body")) > 0)
);
--> statement-breakpoint
ALTER TABLE "services"."messages" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services"."notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"recipient_user_account_id" uuid NOT NULL,
	"student_id" uuid,
	"channel" "common"."notification_channel" NOT NULL,
	"status" "common"."notification_status" DEFAULT 'queued'::"common"."notification_status" NOT NULL,
	"queued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone,
	"payload" jsonb NOT NULL,
	CONSTRAINT "notifications_delivery_consistency" CHECK (("status" = 'delivered') = ("delivered_at" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "services"."notifications" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services"."privacy_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"version" text NOT NULL UNIQUE,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"effective_at" timestamp with time zone NOT NULL,
	"superseded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "services"."referral_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"referral_id" uuid NOT NULL,
	"status" "common"."referral_status" NOT NULL,
	"changed_by_employee_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"feedback_note" text
);
--> statement-breakpoint
ALTER TABLE "services"."referral_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "services"."support_signals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"student_id" uuid NOT NULL,
	"recipient_counselor_employee_id" uuid,
	"submitted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"status" "common"."support_signal_status" DEFAULT 'pending'::"common"."support_signal_status" NOT NULL,
	"acknowledgment_sent_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "services"."support_signals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "attendance_records_enrollment_id_idx" ON "academic"."attendance_records" ("enrollment_id");--> statement-breakpoint
CREATE INDEX "attendance_records_session_id_idx" ON "academic"."attendance_records" ("session_id");--> statement-breakpoint
CREATE INDEX "enrollments_student_id_idx" ON "academic"."enrollments" ("student_id");--> statement-breakpoint
CREATE INDEX "enrollments_section_id_idx" ON "academic"."enrollments" ("section_id");--> statement-breakpoint
CREATE INDEX "grade_records_enrollment_id_idx" ON "academic"."grade_records" ("enrollment_id");--> statement-breakpoint
CREATE INDEX "programs_college_id_idx" ON "academic"."programs" ("college_id");--> statement-breakpoint
CREATE UNIQUE INDEX "section_instructors_one_primary_idx" ON "academic"."section_instructors" ("section_id") WHERE "role" = 'primary';--> statement-breakpoint
CREATE INDEX "sections_term_id_idx" ON "academic"."sections" ("term_id");--> statement-breakpoint
CREATE INDEX "ingestion_discrepancies_status_idx" ON "integration"."ingestion_discrepancies" ("status");--> statement-breakpoint
CREATE INDEX "risk_evaluations_student_time_idx" ON "risk"."risk_evaluations" ("student_id","evaluated_at");--> statement-breakpoint
CREATE INDEX "case_status_history_case_time_idx" ON "services"."case_status_history" ("case_id","changed_at");--> statement-breakpoint
CREATE INDEX "cases_student_id_idx" ON "services"."cases" ("student_id");--> statement-breakpoint
CREATE INDEX "counselor_assignments_student_time_idx" ON "services"."counselor_assignments" ("student_id","effective_from");--> statement-breakpoint
CREATE INDEX "counselor_referrals_student_idx" ON "services"."counselor_referrals" ("student_id");--> statement-breakpoint
CREATE INDEX "notifications_recipient_status_idx" ON "services"."notifications" ("recipient_user_account_id","status");--> statement-breakpoint
CREATE INDEX "referral_status_history_referral_idx" ON "services"."referral_status_history" ("referral_id","changed_at");--> statement-breakpoint
CREATE INDEX "support_signals_recipient_status_idx" ON "services"."support_signals" ("recipient_counselor_employee_id","status");--> statement-breakpoint
ALTER TABLE "academic"."attendance_policies" ADD CONSTRAINT "attendance_policies_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "academic"."sections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "academic"."attendance_records" ADD CONSTRAINT "attendance_records_session_id_class_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "academic"."class_sessions"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "academic"."attendance_records" ADD CONSTRAINT "attendance_records_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "academic"."enrollments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "academic"."attendance_records" ADD CONSTRAINT "attendance_records_recorded_by_employee_id_employees_id_fkey" FOREIGN KEY ("recorded_by_employee_id") REFERENCES "identity"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "academic"."class_sessions" ADD CONSTRAINT "class_sessions_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "academic"."sections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "academic"."curriculum_courses" ADD CONSTRAINT "curriculum_courses_program_id_programs_id_fkey" FOREIGN KEY ("program_id") REFERENCES "academic"."programs"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "academic"."curriculum_courses" ADD CONSTRAINT "curriculum_courses_course_id_courses_id_fkey" FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "academic"."curriculum_courses" ADD CONSTRAINT "curriculum_courses_effective_term_id_academic_terms_id_fkey" FOREIGN KEY ("effective_term_id") REFERENCES "academic"."academic_terms"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "academic"."enrollments" ADD CONSTRAINT "enrollments_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "identity"."students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "academic"."enrollments" ADD CONSTRAINT "enrollments_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "academic"."sections"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "academic"."grade_records" ADD CONSTRAINT "grade_records_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "academic"."enrollments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "academic"."grade_records" ADD CONSTRAINT "grade_records_grade_period_id_grade_periods_id_fkey" FOREIGN KEY ("grade_period_id") REFERENCES "academic"."grade_periods"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "academic"."grade_records" ADD CONSTRAINT "grade_records_submitted_by_employee_id_employees_id_fkey" FOREIGN KEY ("submitted_by_employee_id") REFERENCES "identity"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "academic"."programs" ADD CONSTRAINT "programs_college_id_colleges_id_fkey" FOREIGN KEY ("college_id") REFERENCES "academic"."colleges"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "academic"."section_instructors" ADD CONSTRAINT "section_instructors_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "academic"."sections"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "academic"."section_instructors" ADD CONSTRAINT "section_instructors_employee_id_employees_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "identity"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "academic"."sections" ADD CONSTRAINT "sections_course_id_courses_id_fkey" FOREIGN KEY ("course_id") REFERENCES "academic"."courses"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "academic"."sections" ADD CONSTRAINT "sections_term_id_academic_terms_id_fkey" FOREIGN KEY ("term_id") REFERENCES "academic"."academic_terms"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "governance"."audit_events" ADD CONSTRAINT "audit_events_actor_user_account_id_user_accounts_id_fkey" FOREIGN KEY ("actor_user_account_id") REFERENCES "identity"."user_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "governance"."audit_events" ADD CONSTRAINT "audit_events_target_student_id_students_id_fkey" FOREIGN KEY ("target_student_id") REFERENCES "identity"."students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "identity"."employees" ADD CONSTRAINT "employees_person_id_persons_id_fkey" FOREIGN KEY ("person_id") REFERENCES "identity"."persons"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "identity"."role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "identity"."roles"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "identity"."role_permissions" ADD CONSTRAINT "role_permissions_permission_id_permissions_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "identity"."permissions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "identity"."students" ADD CONSTRAINT "students_person_id_persons_id_fkey" FOREIGN KEY ("person_id") REFERENCES "identity"."persons"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "identity"."user_accounts" ADD CONSTRAINT "user_accounts_person_id_persons_id_fkey" FOREIGN KEY ("person_id") REFERENCES "identity"."persons"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "identity"."user_roles" ADD CONSTRAINT "user_roles_user_account_id_user_accounts_id_fkey" FOREIGN KEY ("user_account_id") REFERENCES "identity"."user_accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "identity"."user_roles" ADD CONSTRAINT "user_roles_role_id_roles_id_fkey" FOREIGN KEY ("role_id") REFERENCES "identity"."roles"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "identity"."user_roles" ADD CONSTRAINT "user_roles_assigned_by_user_account_id_user_accounts_id_fkey" FOREIGN KEY ("assigned_by_user_account_id") REFERENCES "identity"."user_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "integration"."discrepancy_resolutions" ADD CONSTRAINT "discrepancy_resolutions_aSmauUgh49mE_fkey" FOREIGN KEY ("discrepancy_id") REFERENCES "integration"."ingestion_discrepancies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "integration"."discrepancy_resolutions" ADD CONSTRAINT "discrepancy_resolutions_7RKKaY1IRW0J_fkey" FOREIGN KEY ("resolved_by_user_account_id") REFERENCES "identity"."user_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "integration"."external_student_mappings" ADD CONSTRAINT "external_student_mappings_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "identity"."students"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "integration"."financial_hold_snapshots" ADD CONSTRAINT "financial_hold_snapshots_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "identity"."students"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "integration"."ingestion_discrepancies" ADD CONSTRAINT "ingestion_discrepancies_import_batch_id_import_batches_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "integration"."import_batches"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "integration"."offline_sync_operations" ADD CONSTRAINT "offline_sync_operations_session_id_class_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "academic"."class_sessions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "integration"."offline_sync_operations" ADD CONSTRAINT "offline_sync_operations_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "academic"."enrollments"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "integration"."sync_conflicts" ADD CONSTRAINT "sync_conflicts_operation_id_offline_sync_operations_id_fkey" FOREIGN KEY ("operation_id") REFERENCES "integration"."offline_sync_operations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "integration"."sync_conflicts" ADD CONSTRAINT "sync_conflicts_EPPzHWYNKwCF_fkey" FOREIGN KEY ("winning_operation_id") REFERENCES "integration"."offline_sync_operations"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "risk"."risk_evaluations" ADD CONSTRAINT "risk_evaluations_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "identity"."students"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "risk"."risk_rule_versions" ADD CONSTRAINT "risk_rule_versions_H9YBUnAoD79p_fkey" FOREIGN KEY ("rule_definition_id") REFERENCES "risk"."risk_rule_definitions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "risk"."risk_signal_enrollments" ADD CONSTRAINT "risk_signal_enrollments_risk_signal_id_risk_signals_id_fkey" FOREIGN KEY ("risk_signal_id") REFERENCES "risk"."risk_signals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "risk"."risk_signal_enrollments" ADD CONSTRAINT "risk_signal_enrollments_enrollment_id_enrollments_id_fkey" FOREIGN KEY ("enrollment_id") REFERENCES "academic"."enrollments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "risk"."risk_signals" ADD CONSTRAINT "risk_signals_evaluation_id_risk_evaluations_id_fkey" FOREIGN KEY ("evaluation_id") REFERENCES "risk"."risk_evaluations"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "risk"."risk_signals" ADD CONSTRAINT "risk_signals_rule_version_id_risk_rule_versions_id_fkey" FOREIGN KEY ("rule_version_id") REFERENCES "risk"."risk_rule_versions"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "risk"."weekly_delta_digest_entries" ADD CONSTRAINT "weekly_delta_digest_entries_cmt02ySChf1o_fkey" FOREIGN KEY ("digest_id") REFERENCES "risk"."weekly_delta_digests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "risk"."weekly_delta_digest_entries" ADD CONSTRAINT "weekly_delta_digest_entries_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "identity"."students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "risk"."weekly_delta_digests" ADD CONSTRAINT "weekly_delta_digests_counselor_employee_id_employees_id_fkey" FOREIGN KEY ("counselor_employee_id") REFERENCES "identity"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."attendance_policy_acknowledgments" ADD CONSTRAINT "attendance_policy_acknowledgments_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "identity"."students"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "services"."attendance_policy_acknowledgments" ADD CONSTRAINT "attendance_policy_acknowledgments_6QaDh7LyjZ9f_fkey" FOREIGN KEY ("policy_id") REFERENCES "academic"."attendance_policies"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "services"."case_status_history" ADD CONSTRAINT "case_status_history_case_id_cases_id_fkey" FOREIGN KEY ("case_id") REFERENCES "services"."cases"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "services"."case_status_history" ADD CONSTRAINT "case_status_history_changed_by_employee_id_employees_id_fkey" FOREIGN KEY ("changed_by_employee_id") REFERENCES "identity"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."cases" ADD CONSTRAINT "cases_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "identity"."students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."cases" ADD CONSTRAINT "cases_assigned_counselor_employee_id_employees_id_fkey" FOREIGN KEY ("assigned_counselor_employee_id") REFERENCES "identity"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."cases" ADD CONSTRAINT "cases_source_support_signal_id_support_signals_id_fkey" FOREIGN KEY ("source_support_signal_id") REFERENCES "services"."support_signals"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."consent_records" ADD CONSTRAINT "consent_records_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "identity"."students"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "services"."consent_records" ADD CONSTRAINT "consent_records_policy_id_privacy_policies_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "services"."privacy_policies"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."counselor_assignments" ADD CONSTRAINT "counselor_assignments_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "identity"."students"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "services"."counselor_assignments" ADD CONSTRAINT "counselor_assignments_counselor_employee_id_employees_id_fkey" FOREIGN KEY ("counselor_employee_id") REFERENCES "identity"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."counselor_assignments" ADD CONSTRAINT "counselor_assignments_sdsi0iSroIPj_fkey" FOREIGN KEY ("assigned_by_user_account_id") REFERENCES "identity"."user_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."counselor_referrals" ADD CONSTRAINT "counselor_referrals_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "identity"."students"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."counselor_referrals" ADD CONSTRAINT "counselor_referrals_referred_by_employee_id_employees_id_fkey" FOREIGN KEY ("referred_by_employee_id") REFERENCES "identity"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."counselor_referrals" ADD CONSTRAINT "counselor_referrals_section_id_sections_id_fkey" FOREIGN KEY ("section_id") REFERENCES "academic"."sections"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."counselor_referrals" ADD CONSTRAINT "counselor_referrals_case_id_cases_id_fkey" FOREIGN KEY ("case_id") REFERENCES "services"."cases"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "services"."follow_up_reminders" ADD CONSTRAINT "follow_up_reminders_case_id_cases_id_fkey" FOREIGN KEY ("case_id") REFERENCES "services"."cases"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "services"."follow_up_reminders" ADD CONSTRAINT "follow_up_reminders_assigned_to_employee_id_employees_id_fkey" FOREIGN KEY ("assigned_to_employee_id") REFERENCES "identity"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."intervention_notes" ADD CONSTRAINT "intervention_notes_case_id_cases_id_fkey" FOREIGN KEY ("case_id") REFERENCES "services"."cases"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "services"."intervention_notes" ADD CONSTRAINT "intervention_notes_author_employee_id_employees_id_fkey" FOREIGN KEY ("author_employee_id") REFERENCES "identity"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."message_threads" ADD CONSTRAINT "message_threads_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "identity"."students"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "services"."message_threads" ADD CONSTRAINT "message_threads_counselor_employee_id_employees_id_fkey" FOREIGN KEY ("counselor_employee_id") REFERENCES "identity"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."messages" ADD CONSTRAINT "messages_thread_id_message_threads_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "services"."message_threads"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "services"."messages" ADD CONSTRAINT "messages_sender_user_account_id_user_accounts_id_fkey" FOREIGN KEY ("sender_user_account_id") REFERENCES "identity"."user_accounts"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."notifications" ADD CONSTRAINT "notifications_recipient_user_account_id_user_accounts_id_fkey" FOREIGN KEY ("recipient_user_account_id") REFERENCES "identity"."user_accounts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "services"."notifications" ADD CONSTRAINT "notifications_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "identity"."students"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "services"."referral_status_history" ADD CONSTRAINT "referral_status_history_referral_id_counselor_referrals_id_fkey" FOREIGN KEY ("referral_id") REFERENCES "services"."counselor_referrals"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "services"."referral_status_history" ADD CONSTRAINT "referral_status_history_rRCfFxGKiSw5_fkey" FOREIGN KEY ("changed_by_employee_id") REFERENCES "identity"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
ALTER TABLE "services"."support_signals" ADD CONSTRAINT "support_signals_student_id_students_id_fkey" FOREIGN KEY ("student_id") REFERENCES "identity"."students"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "services"."support_signals" ADD CONSTRAINT "support_signals_nkxDXiPjTKNN_fkey" FOREIGN KEY ("recipient_counselor_employee_id") REFERENCES "identity"."employees"("id") ON DELETE RESTRICT;--> statement-breakpoint
CREATE POLICY "service_full_access" ON "academic"."attendance_records" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "academic"."attendance_records" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "attendance_student_select" ON "academic"."attendance_records" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (EXISTS (
    SELECT 1
    FROM academic.enrollments AS e
    WHERE e.id = "academic"."attendance_records"."enrollment_id"
      AND e.student_id = nullif(current_setting('app.student_id', true), '')::uuid
  ));--> statement-breakpoint
CREATE POLICY "service_full_access" ON "academic"."enrollments" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "academic"."enrollments" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "enrollment_student_select" ON "academic"."enrollments" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (nullif(current_setting('app.student_id', true), '')::uuid = student_id);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "academic"."grade_records" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "academic"."grade_records" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "grade_student_select" ON "academic"."grade_records" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (EXISTS (
    SELECT 1
    FROM academic.enrollments AS e
    WHERE e.id = "academic"."grade_records"."enrollment_id"
      AND e.student_id = nullif(current_setting('app.student_id', true), '')::uuid
  ));--> statement-breakpoint
CREATE POLICY "audit_service_insert" ON "governance"."audit_events" AS PERMISSIVE FOR INSERT TO "arise_app_service" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "audit_admin_insert" ON "governance"."audit_events" AS PERMISSIVE FOR INSERT TO "arise_app_admin" WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "audit_auditor_select" ON "governance"."audit_events" AS PERMISSIVE FOR SELECT TO "arise_app_auditor" USING (true);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "identity"."employees" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "identity"."employees" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "student_self_select" ON "identity"."persons" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (nullif(current_setting('app.person_id', true), '')::uuid = id);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "identity"."persons" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "identity"."persons" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "student_self_select" ON "identity"."students" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (nullif(current_setting('app.student_id', true), '')::uuid = id);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "identity"."students" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "identity"."students" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "identity"."user_accounts" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "identity"."user_accounts" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "integration"."discrepancy_resolutions" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "integration"."discrepancy_resolutions" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "financial_hold_student_select" ON "integration"."financial_hold_snapshots" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (nullif(current_setting('app.student_id', true), '')::uuid = student_id);--> statement-breakpoint
CREATE POLICY "financial_hold_counselor_select" ON "integration"."financial_hold_snapshots" AS PERMISSIVE FOR SELECT TO "arise_app_counselor" USING (EXISTS (
    SELECT 1
    FROM services.counselor_assignments AS ca
    WHERE ca.student_id = "integration"."financial_hold_snapshots"."student_id"
      AND ca.counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
  ));--> statement-breakpoint
CREATE POLICY "service_full_access" ON "integration"."financial_hold_snapshots" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "integration"."financial_hold_snapshots" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "integration"."ingestion_discrepancies" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "integration"."ingestion_discrepancies" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "offline_sync_student_select" ON "integration"."offline_sync_operations" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (EXISTS (
    SELECT 1
    FROM academic.enrollments AS e
    WHERE e.id = "integration"."offline_sync_operations"."enrollment_id"
      AND e.student_id = nullif(current_setting('app.student_id', true), '')::uuid
  ));--> statement-breakpoint
CREATE POLICY "service_full_access" ON "integration"."offline_sync_operations" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "integration"."offline_sync_operations" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "integration"."sync_conflicts" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "integration"."sync_conflicts" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "risk_evaluation_student_select" ON "risk"."risk_evaluations" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (nullif(current_setting('app.student_id', true), '')::uuid = student_id);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "risk"."risk_evaluations" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "risk"."risk_evaluations" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "risk"."risk_signal_enrollments" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "risk"."risk_signal_enrollments" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "risk_signal_student_select" ON "risk"."risk_signals" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (EXISTS (
    SELECT 1
    FROM risk.risk_evaluations AS re
    WHERE re.id = "risk"."risk_signals"."evaluation_id"
      AND re.student_id = nullif(current_setting('app.student_id', true), '')::uuid
  ));--> statement-breakpoint
CREATE POLICY "service_full_access" ON "risk"."risk_signals" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "risk"."risk_signals" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "attendance_policy_ack_student_select" ON "services"."attendance_policy_acknowledgments" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (nullif(current_setting('app.student_id', true), '')::uuid = student_id);--> statement-breakpoint
CREATE POLICY "attendance_policy_ack_student_insert" ON "services"."attendance_policy_acknowledgments" AS PERMISSIVE FOR INSERT TO "arise_app_user" WITH CHECK (nullif(current_setting('app.student_id', true), '')::uuid = student_id);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "services"."attendance_policy_acknowledgments" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "services"."attendance_policy_acknowledgments" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "case_status_counselor_select" ON "services"."case_status_history" AS PERMISSIVE FOR SELECT TO "arise_app_counselor" USING (EXISTS (
    SELECT 1
    FROM services.cases AS c
    WHERE c.id = "services"."case_status_history"."case_id"
      AND (
        c.student_id = nullif(current_setting('app.student_id', true), '')::uuid
        OR c.assigned_counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      )
  ));--> statement-breakpoint
CREATE POLICY "service_full_access" ON "services"."case_status_history" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "services"."case_status_history" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "case_student_select" ON "services"."cases" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (nullif(current_setting('app.student_id', true), '')::uuid = student_id);--> statement-breakpoint
CREATE POLICY "case_counselor_select" ON "services"."cases" AS PERMISSIVE FOR SELECT TO "arise_app_counselor" USING (nullif(current_setting('app.employee_id', true), '')::uuid = assigned_counselor_employee_id);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "services"."cases" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "services"."cases" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "consent_student_select" ON "services"."consent_records" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (nullif(current_setting('app.student_id', true), '')::uuid = student_id);--> statement-breakpoint
CREATE POLICY "consent_student_insert" ON "services"."consent_records" AS PERMISSIVE FOR INSERT TO "arise_app_user" WITH CHECK (nullif(current_setting('app.student_id', true), '')::uuid = student_id);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "services"."consent_records" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "services"."consent_records" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "counselor_assignment_student_select" ON "services"."counselor_assignments" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (nullif(current_setting('app.student_id', true), '')::uuid = student_id);--> statement-breakpoint
CREATE POLICY "counselor_assignment_counselor_select" ON "services"."counselor_assignments" AS PERMISSIVE FOR SELECT TO "arise_app_counselor" USING (nullif(current_setting('app.employee_id', true), '')::uuid = counselor_employee_id);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "services"."counselor_assignments" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "services"."counselor_assignments" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "counselor_referral_faculty_insert" ON "services"."counselor_referrals" AS PERMISSIVE FOR INSERT TO "arise_app_faculty" WITH CHECK (nullif(current_setting('app.employee_id', true), '')::uuid = "services"."counselor_referrals"."referred_by_employee_id");--> statement-breakpoint
CREATE POLICY "counselor_referral_faculty_select" ON "services"."counselor_referrals" AS PERMISSIVE FOR SELECT TO "arise_app_faculty" USING (nullif(current_setting('app.employee_id', true), '')::uuid = "services"."counselor_referrals"."referred_by_employee_id");--> statement-breakpoint
CREATE POLICY "counselor_referral_counselor_select" ON "services"."counselor_referrals" AS PERMISSIVE FOR SELECT TO "arise_app_counselor" USING (EXISTS (
    SELECT 1
    FROM services.counselor_assignments AS ca
    WHERE ca.student_id = "services"."counselor_referrals"."student_id"
      AND ca.counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
  ));--> statement-breakpoint
CREATE POLICY "service_full_access" ON "services"."counselor_referrals" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "services"."counselor_referrals" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "follow_up_counselor_select" ON "services"."follow_up_reminders" AS PERMISSIVE FOR SELECT TO "arise_app_counselor" USING (EXISTS (
    SELECT 1
    FROM services.cases AS c
    WHERE c.id = "services"."follow_up_reminders"."case_id"
      AND (
        c.student_id = nullif(current_setting('app.student_id', true), '')::uuid
        OR c.assigned_counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      )
  ));--> statement-breakpoint
CREATE POLICY "service_full_access" ON "services"."follow_up_reminders" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "services"."follow_up_reminders" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "intervention_note_counselor_select" ON "services"."intervention_notes" AS PERMISSIVE FOR SELECT TO "arise_app_counselor" USING (EXISTS (
    SELECT 1
    FROM services.cases AS c
    WHERE c.id = "services"."intervention_notes"."case_id"
      AND (
        c.student_id = nullif(current_setting('app.student_id', true), '')::uuid
        OR c.assigned_counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      )
  ));--> statement-breakpoint
CREATE POLICY "service_full_access" ON "services"."intervention_notes" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "services"."intervention_notes" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "message_thread_student_select" ON "services"."message_threads" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (nullif(current_setting('app.student_id', true), '')::uuid = student_id);--> statement-breakpoint
CREATE POLICY "message_thread_student_insert" ON "services"."message_threads" AS PERMISSIVE FOR INSERT TO "arise_app_user" WITH CHECK (nullif(current_setting('app.student_id', true), '')::uuid = student_id);--> statement-breakpoint
CREATE POLICY "message_thread_counselor_select" ON "services"."message_threads" AS PERMISSIVE FOR SELECT TO "arise_app_counselor" USING (nullif(current_setting('app.employee_id', true), '')::uuid = counselor_employee_id);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "services"."message_threads" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "services"."message_threads" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "message_thread_student_messages" ON "services"."messages" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (EXISTS (
    SELECT 1
    FROM services.message_threads AS mt
    WHERE mt.id = "services"."messages"."thread_id"
      AND (
        mt.student_id = nullif(current_setting('app.student_id', true), '')::uuid
        OR mt.counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      )
  ));--> statement-breakpoint
CREATE POLICY "message_thread_student_messages_insert" ON "services"."messages" AS PERMISSIVE FOR INSERT TO "arise_app_user" WITH CHECK (EXISTS (
    SELECT 1
    FROM services.message_threads AS mt
    WHERE mt.id = "services"."messages"."thread_id"
      AND (
        mt.student_id = nullif(current_setting('app.student_id', true), '')::uuid
        OR mt.counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      )
  ) AND nullif(current_setting('app.user_account_id', true), '')::uuid = "services"."messages"."sender_user_account_id");--> statement-breakpoint
CREATE POLICY "message_thread_counselor_messages" ON "services"."messages" AS PERMISSIVE FOR SELECT TO "arise_app_counselor" USING (EXISTS (
    SELECT 1
    FROM services.message_threads AS mt
    WHERE mt.id = "services"."messages"."thread_id"
      AND (
        mt.student_id = nullif(current_setting('app.student_id', true), '')::uuid
        OR mt.counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      )
  ));--> statement-breakpoint
CREATE POLICY "message_thread_counselor_messages_insert" ON "services"."messages" AS PERMISSIVE FOR INSERT TO "arise_app_counselor" WITH CHECK (EXISTS (
    SELECT 1
    FROM services.message_threads AS mt
    WHERE mt.id = "services"."messages"."thread_id"
      AND (
        mt.student_id = nullif(current_setting('app.student_id', true), '')::uuid
        OR mt.counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      )
  ) AND nullif(current_setting('app.user_account_id', true), '')::uuid = "services"."messages"."sender_user_account_id");--> statement-breakpoint
CREATE POLICY "service_full_access" ON "services"."messages" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "services"."messages" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "notification_recipient_select" ON "services"."notifications" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (nullif(current_setting('app.user_account_id', true), '')::uuid = recipient_user_account_id);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "services"."notifications" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "services"."notifications" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "referral_status_faculty_select" ON "services"."referral_status_history" AS PERMISSIVE FOR SELECT TO "arise_app_faculty" USING (EXISTS (
        SELECT 1
        FROM services.counselor_referrals AS cr
        WHERE cr.id = "services"."referral_status_history"."referral_id"
          AND cr.referred_by_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      ));--> statement-breakpoint
CREATE POLICY "referral_status_counselor_select" ON "services"."referral_status_history" AS PERMISSIVE FOR SELECT TO "arise_app_counselor" USING (EXISTS (
        SELECT 1
        FROM services.counselor_referrals AS cr
        JOIN services.counselor_assignments AS ca ON ca.student_id = cr.student_id
        WHERE cr.id = "services"."referral_status_history"."referral_id"
          AND ca.counselor_employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
          AND ca.effective_from <= now()
          AND (ca.effective_until IS NULL OR ca.effective_until > now())
      ));--> statement-breakpoint
CREATE POLICY "service_full_access" ON "services"."referral_status_history" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "services"."referral_status_history" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "support_signal_student_insert" ON "services"."support_signals" AS PERMISSIVE FOR INSERT TO "arise_app_user" WITH CHECK (nullif(current_setting('app.student_id', true), '')::uuid = student_id);--> statement-breakpoint
CREATE POLICY "support_signal_student_select" ON "services"."support_signals" AS PERMISSIVE FOR SELECT TO "arise_app_user" USING (nullif(current_setting('app.student_id', true), '')::uuid = student_id);--> statement-breakpoint
CREATE POLICY "support_signal_counselor_select" ON "services"."support_signals" AS PERMISSIVE FOR SELECT TO "arise_app_counselor" USING (nullif(current_setting('app.employee_id', true), '')::uuid = recipient_counselor_employee_id);--> statement-breakpoint
CREATE POLICY "service_full_access" ON "services"."support_signals" AS PERMISSIVE FOR ALL TO "arise_app_service" USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "admin_full_access" ON "services"."support_signals" AS PERMISSIVE FOR ALL TO "arise_app_admin" USING (true) WITH CHECK (true);