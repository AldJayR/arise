import { sql } from "drizzle-orm";
import {
  check,
  date,
  pgPolicy,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { accountStatus, employmentStatus, personStatus } from "./enums";
import {
  adminAccess,
  appCounselorRole,
  appFacultyRole,
  appUserRole,
  counselorOwnsStudent,
  facultyOwnsStudent,
  serviceAccess,
  userOwnsPerson,
  userOwnsStudent,
} from "./rls";

export const identity = pgSchema("identity");

export const persons = identity.table.withRLS(
  "persons",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    legalGivenName: text("legal_given_name").notNull(),
    legalFamilyName: text("legal_family_name").notNull(),
    displayName: text("display_name").notNull(),
    institutionalEmail: text("institutional_email").unique(),
    phoneE164: text("phone_e164"),
    status: personStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    pgPolicy("student_self_select", {
      for: "select",
      to: appUserRole,
      using: userOwnsPerson("id"),
    }),
    pgPolicy("person_faculty_select", {
      for: "select",
      to: appFacultyRole,
      using: sql`EXISTS (
        SELECT 1
        FROM identity.students AS s
        JOIN academic.enrollments AS e ON e.student_id = s.id
        JOIN academic.section_instructors AS si ON si.section_id = e.section_id
        WHERE s.person_id = ${t.id}
          AND e.status = 'enrolled'
          AND si.employee_id = nullif(current_setting('app.employee_id', true), '')::uuid
      )`,
    }),
    pgPolicy("person_counselor_select", {
      for: "select",
      to: appCounselorRole,
      using: sql`EXISTS (
        SELECT 1
        FROM identity.students AS s
        WHERE s.person_id = ${t.id}
          AND ${counselorOwnsStudent(sql`s.id`)}
      )`,
    }),
    serviceAccess(),
    adminAccess(),
    check(
      "persons_names_not_blank",
      sql`char_length(trim(${t.legalGivenName})) > 0 AND char_length(trim(${t.legalFamilyName})) > 0`,
    ),
    check(
      "persons_email_lowercase",
      sql`${t.institutionalEmail} IS NULL OR ${t.institutionalEmail} = lower(${t.institutionalEmail})`,
    ),
  ],
);

export const students = identity.table.withRLS(
  "students",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "restrict" })
      .unique(),
    institutionalStudentNumber: text("institutional_student_number")
      .notNull()
      .unique(),
    admissionDate: date("admission_date", { mode: "string" }),
    status: personStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    pgPolicy("student_self_select", {
      for: "select",
      to: appUserRole,
      using: userOwnsStudent("id"),
    }),
    pgPolicy("student_faculty_select", {
      for: "select",
      to: appFacultyRole,
      using: facultyOwnsStudent(t.id),
    }),
    pgPolicy("student_counselor_select", {
      for: "select",
      to: appCounselorRole,
      using: counselorOwnsStudent(t.id),
    }),
    serviceAccess(),
    adminAccess(),
    check(
      "students_number_not_blank",
      sql`char_length(trim(${t.institutionalStudentNumber})) > 0`,
    ),
  ],
);

export const employees = identity.table.withRLS(
  "employees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "restrict" })
      .unique(),
    employeeNumber: text("employee_number").notNull().unique(),
    status: employmentStatus("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    serviceAccess(),
    adminAccess(),
    check(
      "employees_number_not_blank",
      sql`char_length(trim(${t.employeeNumber})) > 0`,
    ),
  ],
);

export const userAccounts = identity.table.withRLS(
  "user_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    personId: uuid("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "restrict" })
      .unique(),
    authenticationSubject: text("authentication_subject").notNull().unique(),
    status: accountStatus("status").notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    serviceAccess(),
    adminAccess(),
    check(
      "user_accounts_subject_not_blank",
      sql`char_length(trim(${t.authenticationSubject})) > 0`,
    ),
  ],
);

export const roles = identity.table("roles", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
});

export const permissions = identity.table("permissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull(),
});

export const userRoles = identity.table(
  "user_roles",
  {
    userAccountId: uuid("user_account_id")
      .notNull()
      .references(() => userAccounts.id, { onDelete: "cascade" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    assignedByUserAccountId: uuid("assigned_by_user_account_id").references(
      () => userAccounts.id,
      { onDelete: "restrict" },
    ),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userAccountId, t.roleId] })],
);

export const rolePermissions = identity.table(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id")
      .notNull()
      .references(() => permissions.id, { onDelete: "restrict" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);
