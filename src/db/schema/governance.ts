import { sql } from "drizzle-orm";
import {
  check,
  jsonb,
  pgPolicy,
  pgSchema,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { auditAction } from "./enums";
import { students, userAccounts } from "./identity";
import { appAdminRole, appAuditorRole, appServiceRole } from "./rls";

export const governance = pgSchema("governance");

export const auditEvents = governance.table.withRLS(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserAccountId: uuid("actor_user_account_id").references(
      () => userAccounts.id,
      { onDelete: "restrict" },
    ),
    targetStudentId: uuid("target_student_id").references(() => students.id, {
      onDelete: "restrict",
    }),
    action: auditAction("action").notNull(),
    targetSchema: text("target_schema").notNull(),
    targetTable: text("target_table").notNull(),
    targetRecordId: uuid("target_record_id"),
    requestId: uuid("request_id"),
    occurredAt: timestamp("occurred_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    previousHash: text("previous_hash"),
    eventHash: text("event_hash").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull(),
  },
  (t) => [
    pgPolicy("audit_service_insert", {
      for: "insert",
      to: appServiceRole,
      withCheck: sql`true`,
    }),
    pgPolicy("audit_admin_insert", {
      for: "insert",
      to: appAdminRole,
      withCheck: sql`true`,
    }),
    pgPolicy("audit_auditor_select", {
      for: "select",
      to: appAuditorRole,
      using: sql`true`,
    }),
    check(
      "audit_events_target_schema_not_blank",
      sql`char_length(trim(${t.targetSchema})) > 0`,
    ),
    check(
      "audit_events_target_table_not_blank",
      sql`char_length(trim(${t.targetTable})) > 0`,
    ),
  ],
);
