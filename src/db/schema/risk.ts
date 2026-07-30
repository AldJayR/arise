import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgPolicy,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { enrollments } from "./academic";
import { riskRuleType, riskSeverity, thresholdUnit } from "./enums";
import { employees, students } from "./identity";
import {
  adminAccess,
  appUserRole,
  canAccessRiskSignal,
  serviceAccess,
  userOwnsStudent,
} from "./rls";

export const risk = pgSchema("risk");

export const riskRuleDefinitions = risk.table("risk_rule_definitions", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: riskRuleType("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
});

export const riskRuleVersions = risk.table(
  "risk_rule_versions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ruleDefinitionId: uuid("rule_definition_id")
      .notNull()
      .references(() => riskRuleDefinitions.id, { onDelete: "restrict" }),
    version: integer("version").notNull(),
    thresholdValue: numeric("threshold_value", {
      precision: 8,
      scale: 2,
      mode: "number",
    }).notNull(),
    thresholdUnit: thresholdUnit("threshold_unit").notNull(),
    activeFrom: timestamp("active_from", { withTimezone: true }).notNull(),
    activeUntil: timestamp("active_until", { withTimezone: true }),
  },
  (t) => [
    unique("risk_rule_versions_definition_version_key").on(
      t.ruleDefinitionId,
      t.version,
    ),
    check(
      "risk_rule_versions_time_order",
      sql`${t.activeUntil} IS NULL OR ${t.activeUntil} > ${t.activeFrom}`,
    ),
    check(
      "risk_rule_versions_threshold_nonnegative",
      sql`${t.thresholdValue} >= 0`,
    ),
  ],
);

export const riskEvaluations = risk.table.withRLS(
  "risk_evaluations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    engineVersion: text("engine_version").notNull(),
  },
  (t) => [
    pgPolicy("risk_evaluation_student_select", {
      for: "select",
      to: appUserRole,
      using: userOwnsStudent("student_id"),
    }),
    serviceAccess(),
    adminAccess(),
    index("risk_evaluations_student_time_idx").on(t.studentId, t.evaluatedAt),
  ],
);

export const riskSignals = risk.table.withRLS(
  "risk_signals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    evaluationId: uuid("evaluation_id")
      .notNull()
      .references(() => riskEvaluations.id, { onDelete: "cascade" }),
    ruleVersionId: uuid("rule_version_id")
      .notNull()
      .references(() => riskRuleVersions.id, { onDelete: "restrict" }),
    severity: riskSeverity("severity").notNull(),
    triggeredAt: timestamp("triggered_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    pgPolicy("risk_signal_student_select", {
      for: "select",
      to: appUserRole,
      using: canAccessRiskSignal(t.evaluationId),
    }),
    serviceAccess(),
    adminAccess(),
  ],
);

export const riskSignalEnrollments = risk.table.withRLS(
  "risk_signal_enrollments",
  {
    riskSignalId: uuid("risk_signal_id")
      .notNull()
      .references(() => riskSignals.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.riskSignalId, t.enrollmentId] }),
    serviceAccess(),
    adminAccess(),
  ],
);

export const weeklyDeltaDigests = risk.table(
  "weekly_delta_digests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    counselorEmployeeId: uuid("counselor_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    windowStartsAt: timestamp("window_starts_at", {
      withTimezone: true,
    }).notNull(),
    windowEndsAt: timestamp("window_ends_at", { withTimezone: true }).notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("weekly_delta_digests_counselor_window_key").on(
      t.counselorEmployeeId,
      t.windowStartsAt,
      t.windowEndsAt,
    ),
    check(
      "weekly_delta_digests_window_order",
      sql`${t.windowEndsAt} > ${t.windowStartsAt}`,
    ),
  ],
);

export const weeklyDeltaDigestEntries = risk.table(
  "weekly_delta_digest_entries",
  {
    digestId: uuid("digest_id")
      .notNull()
      .references(() => weeklyDeltaDigests.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    rank: integer("rank").notNull(),
    deltaMagnitude: numeric("delta_magnitude", {
      precision: 8,
      scale: 2,
      mode: "number",
    }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.digestId, t.studentId] }),
    unique("weekly_delta_digest_entries_rank_key").on(t.digestId, t.rank),
    check("weekly_delta_digest_entries_rank_positive", sql`${t.rank} > 0`),
  ],
);
