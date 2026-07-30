import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgPolicy,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { classSessions, enrollments } from "./academic";
import {
  attendanceStatus,
  discrepancyStatus,
  syncOperationStatus,
} from "./enums";
import { students, userAccounts } from "./identity";
import {
  adminAccess,
  appCounselorRole,
  appUserRole,
  canAccessEnrollment,
  counselorOwnsStudent,
  serviceAccess,
  userOwnsStudent,
} from "./rls";

export const integration = pgSchema("integration");

export const importBatches = integration.table(
  "import_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sourceSystem: text("source_system").notNull(),
    sourceBatchKey: text("source_batch_key").notNull().unique(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    check(
      "import_batches_source_not_blank",
      sql`char_length(trim(${t.sourceSystem})) > 0`,
    ),
  ],
);

export const externalStudentMappings = integration.table(
  "external_student_mappings",
  {
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    sourceSystem: text("source_system").notNull(),
    externalStudentKey: text("external_student_key").notNull(),
    firstSeenAt: timestamp("first_seen_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.sourceSystem, t.externalStudentKey] }),
    unique("external_student_mappings_student_source_key").on(
      t.studentId,
      t.sourceSystem,
    ),
  ],
);

export const financialHoldSnapshots = integration.table.withRLS(
  "financial_hold_snapshots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    sourceSystem: text("source_system").notNull(),
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull(),
    holdActive: boolean("hold_active").notNull(),
  },
  (t) => [
    unique("financial_hold_snapshots_source_effective_key").on(
      t.studentId,
      t.sourceSystem,
      t.effectiveAt,
    ),
    pgPolicy("financial_hold_student_select", {
      for: "select",
      to: appUserRole,
      using: userOwnsStudent("student_id"),
    }),
    pgPolicy("financial_hold_counselor_select", {
      for: "select",
      to: appCounselorRole,
      using: counselorOwnsStudent(t.studentId),
    }),
    serviceAccess(),
    adminAccess(),
  ],
);

export const offlineSyncOperations = integration.table.withRLS(
  "offline_sync_operations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    clientOperationId: uuid("client_operation_id").notNull().unique(),
    deviceId: text("device_id").notNull(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "restrict" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "restrict" }),
    requestedStatus: attendanceStatus("requested_status").notNull(),
    vectorClock: jsonb("vector_clock")
      .$type<Record<string, number>>()
      .notNull(),
    clientRecordedAt: timestamp("client_recorded_at", {
      withTimezone: true,
    }).notNull(),
    receivedAt: timestamp("received_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    status: syncOperationStatus("status").notNull().default("received"),
  },
  (t) => [
    pgPolicy("offline_sync_student_select", {
      for: "select",
      to: appUserRole,
      using: canAccessEnrollment(t.enrollmentId),
    }),
    serviceAccess(),
    adminAccess(),
    check(
      "offline_sync_device_not_blank",
      sql`char_length(trim(${t.deviceId})) > 0`,
    ),
  ],
);

export const syncConflicts = integration.table.withRLS(
  "sync_conflicts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    operationId: uuid("operation_id")
      .notNull()
      .references(() => offlineSyncOperations.id, { onDelete: "restrict" }),
    winningOperationId: uuid("winning_operation_id")
      .notNull()
      .references(() => offlineSyncOperations.id, { onDelete: "restrict" }),
    resolutionReason: text("resolution_reason").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("sync_conflicts_operation_winner_key").on(
      t.operationId,
      t.winningOperationId,
    ),
    serviceAccess(),
    adminAccess(),
    check(
      "sync_conflicts_distinct_operations",
      sql`${t.operationId} <> ${t.winningOperationId}`,
    ),
  ],
);

export const ingestionDiscrepancies = integration.table.withRLS(
  "ingestion_discrepancies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    importBatchId: uuid("import_batch_id")
      .notNull()
      .references(() => importBatches.id, { onDelete: "cascade" }),
    discrepancyType: text("discrepancy_type").notNull(),
    externalKey: text("external_key").notNull(),
    description: text("description").notNull(),
    status: discrepancyStatus("status").notNull().default("open"),
    detectedAt: timestamp("detected_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    serviceAccess(),
    adminAccess(),
    index("ingestion_discrepancies_status_idx").on(t.status),
  ],
);

export const discrepancyResolutions = integration.table.withRLS(
  "discrepancy_resolutions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    discrepancyId: uuid("discrepancy_id")
      .notNull()
      .references(() => ingestionDiscrepancies.id, { onDelete: "cascade" }),
    resolvedByUserAccountId: uuid("resolved_by_user_account_id")
      .notNull()
      .references(() => userAccounts.id, { onDelete: "restrict" }),
    resolution: text("resolution").notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    serviceAccess(),
    adminAccess(),
    check(
      "discrepancy_resolutions_not_blank",
      sql`char_length(trim(${t.resolution})) > 0`,
    ),
  ],
);
