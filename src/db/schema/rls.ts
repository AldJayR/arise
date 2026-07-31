import { type SQLWrapper, sql } from "drizzle-orm";
import { pgPolicy, pgRole } from "drizzle-orm/pg-core";

export const appUserRole = pgRole("arise_app_user", { inherit: false });
export const appFacultyRole = pgRole("arise_app_faculty", { inherit: false });
export const appCounselorRole = pgRole("arise_app_counselor", {
  inherit: false,
});
export const appRegistrarRole = pgRole("arise_app_registrar", {
  inherit: false,
});
export const appDeanRole = pgRole("arise_app_dean", { inherit: false });
export const appServiceRole = pgRole("arise_app_service", { inherit: false });
export const appAuditorRole = pgRole("arise_app_auditor", { inherit: false });
export const appAdminRole = pgRole("arise_app_admin", { inherit: false });

export const serviceAccess = () =>
  pgPolicy("service_full_access", {
    as: "permissive",
    for: "all",
    to: appServiceRole,
    using: sql`true`,
    withCheck: sql`true`,
  });

export const adminAccess = () =>
  pgPolicy("admin_full_access", {
    as: "permissive",
    for: "all",
    to: appAdminRole,
    using: sql`true`,
    withCheck: sql`true`,
  });

const currentStudentId = sql`nullif(current_setting('app.student_id', true), '')::uuid`;
const currentPersonId = sql`nullif(current_setting('app.person_id', true), '')::uuid`;
const currentEmployeeId = sql`nullif(current_setting('app.employee_id', true), '')::uuid`;
const currentAccountId = sql`nullif(current_setting('app.user_account_id', true), '')::uuid`;

export const userOwnsStudent = (column: string) =>
  sql`${currentStudentId} = ${sql.raw(column)}`;

export const userOwnsPerson = (column: string) =>
  sql`${currentPersonId} = ${sql.raw(column)}`;

export const userOwnsAccount = (column: string) =>
  sql`${currentAccountId} = ${sql.raw(column)}`;

export const counselorOwnsEmployee = (column: string) =>
  sql`${currentEmployeeId} = ${sql.raw(column)}`;

export const counselorOwnsStudent = (column: SQLWrapper) =>
  sql`EXISTS (
    SELECT 1
    FROM services.counselor_assignments AS ca
    WHERE ca.student_id = ${column}
      AND ca.counselor_employee_id = ${currentEmployeeId}
      AND ca.effective_from <= now()
      AND (ca.effective_until IS NULL OR ca.effective_until > now())
  )`;

export const facultyOwnsSection = (column: SQLWrapper) =>
  sql`EXISTS (
    SELECT 1
    FROM academic.section_instructors AS si
    WHERE si.section_id = ${column}
      AND si.employee_id = ${currentEmployeeId}
  )`;

export const facultyOwnsStudent = (column: SQLWrapper) =>
  sql`EXISTS (
    SELECT 1
    FROM academic.enrollments AS e
    JOIN academic.section_instructors AS si ON si.section_id = e.section_id
    WHERE e.student_id = ${column}
      AND e.status = 'enrolled'
      AND si.employee_id = ${currentEmployeeId}
  )`;

export const canAccessEnrollment = (column: SQLWrapper) =>
  sql`EXISTS (
    SELECT 1
    FROM academic.enrollments AS e
    WHERE e.id = ${column}
      AND e.student_id = ${currentStudentId}
  )`;

export const canAccessCase = (column: SQLWrapper) =>
  sql`EXISTS (
    SELECT 1
    FROM services.cases AS c
    WHERE c.id = ${column}
      AND (
        c.student_id = ${currentStudentId}
        OR c.assigned_counselor_employee_id = ${currentEmployeeId}
      )
  )`;

export const canAccessThread = (column: SQLWrapper) =>
  sql`EXISTS (
    SELECT 1
    FROM services.message_threads AS mt
    WHERE mt.id = ${column}
      AND (
        mt.student_id = ${currentStudentId}
        OR mt.counselor_employee_id = ${currentEmployeeId}
      )
  )`;

export const canAccessRiskSignal = (column: SQLWrapper) =>
  sql`EXISTS (
    SELECT 1
    FROM risk.risk_evaluations AS re
    WHERE re.id = ${column}
      AND re.student_id = ${currentStudentId}
  )`;
