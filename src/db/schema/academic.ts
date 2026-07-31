import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  numeric,
  pgPolicy,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  assignmentRole,
  attendanceSource,
  attendanceStatus,
  enrollmentStatus,
  gradeMarkKind,
  gradePeriodKind,
  sectionStatus,
  sessionType,
  termKind,
} from "./enums";
import { employees, students } from "./identity";
import {
  adminAccess,
  appFacultyRole,
  appUserRole,
  canAccessEnrollment,
  facultyOwnsSection,
  serviceAccess,
  userOwnsStudent,
} from "./rls";

export const academic = pgSchema("academic");

export const colleges = academic.table("colleges", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
});

export const programs = academic.table(
  "programs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    collegeId: uuid("college_id")
      .notNull()
      .references(() => colleges.id, { onDelete: "restrict" }),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    degreeType: text("degree_type").notNull(),
  },
  (t) => [index("programs_college_id_idx").on(t.collegeId)],
);

export const academicTerms = academic.table(
  "academic_terms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    academicYear: text("academic_year").notNull(),
    kind: termKind("kind").notNull(),
    startsOn: date("starts_on", { mode: "string" }).notNull(),
    endsOn: date("ends_on", { mode: "string" }).notNull(),
    enrollmentOpensAt: timestamp("enrollment_opens_at", {
      withTimezone: true,
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [check("academic_terms_date_order", sql`${t.endsOn} > ${t.startsOn}`)],
);

export const courses = academic.table(
  "courses",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    code: text("code").notNull().unique(),
    title: text("title").notNull(),
    creditUnits: numeric("credit_units", {
      precision: 4,
      scale: 2,
      mode: "number",
    }).notNull(),
  },
  (t) => [check("courses_credit_units_positive", sql`${t.creditUnits} > 0`)],
);

export const curriculumCourses = academic.table(
  "curriculum_courses",
  {
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "restrict" }),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    effectiveTermId: uuid("effective_term_id")
      .notNull()
      .references(() => academicTerms.id, { onDelete: "restrict" }),
    required: boolean("required").notNull().default(true),
  },
  (t) => [
    primaryKey({ columns: [t.programId, t.courseId, t.effectiveTermId] }),
  ],
);

export const sections = academic.table(
  "sections",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    courseId: uuid("course_id")
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    termId: uuid("term_id")
      .notNull()
      .references(() => academicTerms.id, { onDelete: "restrict" }),
    sectionCode: text("section_code").notNull(),
    capacity: integer("capacity"),
    status: sectionStatus("status").notNull().default("planned"),
  },
  (t) => [
    unique("sections_course_term_code_key").on(
      t.courseId,
      t.termId,
      t.sectionCode,
    ),
    check(
      "sections_capacity_positive",
      sql`${t.capacity} IS NULL OR ${t.capacity} > 0`,
    ),
    index("sections_term_id_idx").on(t.termId),
  ],
);

export const sectionInstructors = academic.table(
  "section_instructors",
  {
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    employeeId: uuid("employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    role: assignmentRole("role").notNull(),
    assignedAt: timestamp("assigned_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.sectionId, t.employeeId] }),
    uniqueIndex("section_instructors_one_primary_idx")
      .on(t.sectionId)
      .where(sql`${t.role} = 'primary'`),
  ],
);

export const enrollments = academic.table.withRLS(
  "enrollments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "restrict" }),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "restrict" }),
    status: enrollmentStatus("status").notNull().default("enrolled"),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    withdrawnAt: timestamp("withdrawn_at", { withTimezone: true }),
  },
  (t) => [
    unique("enrollments_student_section_key").on(t.studentId, t.sectionId),
    serviceAccess(),
    adminAccess(),
    pgPolicy("enrollment_faculty_select", {
      for: "select",
      to: appFacultyRole,
      using: facultyOwnsSection(t.sectionId),
    }),
    pgPolicy("enrollment_student_select", {
      as: "permissive",
      for: "select",
      to: appUserRole,
      using: userOwnsStudent("student_id"),
    }),
    check(
      "enrollments_withdrawn_at_consistency",
      sql`(${t.status} = 'withdrawn') = (${t.withdrawnAt} IS NOT NULL)`,
    ),
    index("enrollments_student_id_idx").on(t.studentId),
    index("enrollments_section_id_idx").on(t.sectionId),
  ],
);

export const gradePeriods = academic.table("grade_periods", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: gradePeriodKind("code").notNull().unique(),
  sequence: integer("sequence").notNull().unique(),
});

export const gradeRecords = academic.table.withRLS(
  "grade_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    gradePeriodId: uuid("grade_period_id")
      .notNull()
      .references(() => gradePeriods.id, { onDelete: "restrict" }),
    markKind: gradeMarkKind("mark_kind").notNull(),
    numericValue: numeric("numeric_value", {
      precision: 3,
      scale: 2,
      mode: "number",
    }),
    submittedByEmployeeId: uuid("submitted_by_employee_id")
      .notNull()
      .references(() => employees.id, { onDelete: "restrict" }),
    submittedAt: timestamp("submitted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
  },
  (t) => [
    unique("grade_records_enrollment_period_key").on(
      t.enrollmentId,
      t.gradePeriodId,
    ),
    serviceAccess(),
    adminAccess(),
    pgPolicy("grade_student_select", {
      as: "permissive",
      for: "select",
      to: appUserRole,
      using: canAccessEnrollment(t.enrollmentId),
    }),
    check(
      "grade_records_mark_value_consistency",
      sql`(${t.markKind} = 'numeric' AND ${t.numericValue} BETWEEN 1.00 AND 5.00) OR (${t.markKind} <> 'numeric' AND ${t.numericValue} IS NULL)`,
    ),
    check(
      "grade_records_lock_after_submission",
      sql`${t.lockedAt} IS NULL OR ${t.lockedAt} >= ${t.submittedAt}`,
    ),
    index("grade_records_enrollment_id_idx").on(t.enrollmentId),
  ],
);

export const classSessions = academic.table(
  "class_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" }),
    sessionSequence: integer("session_sequence").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    type: sessionType("type").notNull(),
  },
  (t) => [
    unique("class_sessions_section_sequence_key").on(
      t.sectionId,
      t.sessionSequence,
    ),
    check("class_sessions_sequence_positive", sql`${t.sessionSequence} > 0`),
    check(
      "class_sessions_time_order",
      sql`${t.endsAt} IS NULL OR ${t.endsAt} > ${t.startsAt}`,
    ),
  ],
);

export const attendancePolicies = academic.table(
  "attendance_policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sectionId: uuid("section_id")
      .notNull()
      .references(() => sections.id, { onDelete: "cascade" })
      .unique(),
    policyVersion: text("policy_version").notNull(),
    allowableAbsences: integer("allowable_absences").notNull(),
    policyText: text("policy_text").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
  },
  (t) => [
    check(
      "attendance_policies_allowable_absences_nonnegative",
      sql`${t.allowableAbsences} >= 0`,
    ),
  ],
);

export const attendanceRecords = academic.table.withRLS(
  "attendance_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => classSessions.id, { onDelete: "cascade" }),
    enrollmentId: uuid("enrollment_id")
      .notNull()
      .references(() => enrollments.id, { onDelete: "cascade" }),
    status: attendanceStatus("status").notNull(),
    source: attendanceSource("source").notNull(),
    recordedByEmployeeId: uuid("recorded_by_employee_id").references(
      () => employees.id,
      { onDelete: "restrict" },
    ),
    recordedAt: timestamp("recorded_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    clientOperationId: uuid("client_operation_id"),
  },
  (t) => [
    unique("attendance_records_session_enrollment_key").on(
      t.sessionId,
      t.enrollmentId,
    ),
    serviceAccess(),
    adminAccess(),
    pgPolicy("attendance_student_select", {
      as: "permissive",
      for: "select",
      to: appUserRole,
      using: canAccessEnrollment(t.enrollmentId),
    }),
    index("attendance_records_enrollment_id_idx").on(t.enrollmentId),
    index("attendance_records_session_id_idx").on(t.sessionId),
  ],
);
