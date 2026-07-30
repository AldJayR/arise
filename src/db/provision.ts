import { pathToFileURL } from "node:url";
import { sql } from "drizzle-orm";
import { createDatabase } from "./client";

export async function provisionApplicationRoles() {
  const { db, pool } = createDatabase();

  try {
    await db.execute(sql`
      grant usage on schema common, identity, academic, services, risk, integration, governance
      to arise_app_user, arise_app_faculty, arise_app_counselor, arise_app_registrar,
        arise_app_dean, arise_app_service, arise_app_auditor, arise_app_admin
    `);
    await db.execute(sql`
      grant select on all tables in schema identity, academic, services, risk, integration
      to arise_app_user, arise_app_faculty, arise_app_counselor, arise_app_registrar, arise_app_dean
    `);
    await db.execute(sql`
      grant insert on services.attendance_policy_acknowledgments, services.consent_records,
        services.support_signals, services.message_threads, services.messages
      to arise_app_user
    `);
    await db.execute(sql`
      grant select, insert, update on services.counselor_referrals, services.referral_status_history
      to arise_app_faculty
    `);
    await db.execute(sql`
      grant select on governance.audit_events to arise_app_auditor
    `);
    await db.execute(sql`
      grant insert on governance.audit_events to arise_app_service, arise_app_admin
    `);
    await db.execute(sql`
      grant select, insert, update, delete on all tables in schema identity, academic, services, risk, integration
      to arise_app_service, arise_app_admin
    `);
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await provisionApplicationRoles();
}
