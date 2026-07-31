import "dotenv/config";
import { randomBytes } from "node:crypto";
import { pathToFileURL } from "node:url";
import { and, eq } from "drizzle-orm";
import { createDatabase, type RlsTransaction } from "./client";
import { user as authUsers } from "./schema/auth";
import {
  academicTerms,
  attendancePolicies,
  counselorAssignments,
  courses,
  employees,
  enrollments,
  gradePeriods,
  permissions,
  persons,
  privacyPolicies,
  riskRuleDefinitions,
  riskRuleVersions,
  rolePermissions,
  roles,
  sectionInstructors,
  sections,
  students,
  userAccounts,
  userRoles,
} from "./schema";
import { auth } from "@/lib/auth";

type DemoActor = {
  key: string;
  givenName: string;
  familyName: string;
  email: string;
  employeeNumber?: string;
  studentNumber?: string;
  role: "faculty" | "counselor" | "student" | "registrar";
};

const demoActors: DemoActor[] = [
  {
    key: "faculty",
    givenName: "Maya",
    familyName: "Santos",
    email: "maya.santos@demo.arise.local",
    employeeNumber: "DEMO-FAC-001",
    role: "faculty",
  },
  {
    key: "counselor",
    givenName: "Liam",
    familyName: "Reyes",
    email: "liam.reyes@demo.arise.local",
    employeeNumber: "DEMO-CNS-001",
    role: "counselor",
  },
  {
    key: "registrar",
    givenName: "Cynthia",
    familyName: "Garcia",
    email: "cynthia.garcia@demo.arise.local",
    employeeNumber: "DEMO-REG-001",
    role: "registrar",
  },
  ...[
    ["Ari", "Dela Cruz", "DEMO-STU-001"],
    ["Bea", "Navarro", "DEMO-STU-002"],
    ["Cal", "Villanueva", "DEMO-STU-003"],
    ["Dani", "Garcia", "DEMO-STU-004"],
  ].map(([givenName, familyName, studentNumber], index) => ({
    key: `student-${index + 1}`,
    givenName,
    familyName,
    email: `${givenName.toLowerCase()}.${familyName.split(" ")[0].toLowerCase()}@demo.arise.local`,
    studentNumber,
    role: "student" as const,
  })),
];

const demoRoles = [
  ["student", "Student access"],
  ["faculty", "Faculty access"],
  ["counselor", "Counselor access"],
  ["registrar", "Registrar access"],
  ["dean", "Dean access"],
  ["auditor", "Auditor access"],
  ["service", "Service account access"],
  ["admin", "Administrator access"],
] as const;

const demoPermissions = [
  ["student:dashboard", "Read the student dashboard"],
  ["student:support-signal", "Submit a confidential support signal"],
  ["auth:provision", "Provision authentication access for an ARISE identity"],
  ["faculty:attendance", "Manage section attendance"],
  ["faculty:grades", "Manage section grades"],
  ["counselor:support-queue", "Read assigned support signals"],
] as const;

const riskDefaults = [
  [
    "attendance_warning",
    "Attendance warning",
    "Attendance usage reached the warning threshold",
    75,
    "percentage",
  ],
  [
    "attendance_critical",
    "Attendance critical",
    "Attendance usage reached the critical threshold",
    100,
    "percentage",
  ],
  [
    "numeric_grade_decline",
    "Numeric grade decline",
    "A student's numeric grade declined beyond the configured threshold",
    0,
    "count",
  ],
  [
    "unresolved_inc",
    "Unresolved incomplete",
    "A student has an unresolved incomplete mark",
    1,
    "count",
  ],
  ["drp", "Dropped course", "A student has a DRP mark", 1, "boolean"],
  [
    "cross_subject",
    "Cross-subject risk",
    "A student has risk signals in at least two subjects",
    2,
    "count",
  ],
] as const;

function requireSeedValue<T>(map: Map<string, T>, key: string) {
  const value = map.get(key);
  if (!value) {
    throw new Error(`Seed value ${key} was not created`);
  }
  return value;
}

async function getOrCreatePerson(
  transaction: RlsTransaction,
  actor: DemoActor,
) {
  const [existing] = await transaction
    .select({ id: persons.id })
    .from(persons)
    .where(eq(persons.institutionalEmail, actor.email))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const [created] = await transaction
    .insert(persons)
    .values({
      legalGivenName: actor.givenName,
      legalFamilyName: actor.familyName,
      displayName: `${actor.givenName} ${actor.familyName}`,
      institutionalEmail: actor.email,
    })
    .returning({ id: persons.id });

  return created.id;
}

async function getOrCreateAccount(
  transaction: RlsTransaction,
  personId: string,
  actor: DemoActor,
) {
  const [existing] = await transaction
    .select({
      id: userAccounts.id,
      authenticationSubject: userAccounts.authenticationSubject,
    })
    .from(userAccounts)
    .where(eq(userAccounts.personId, personId))
    .limit(1);

  const [existingAuthUser] = await transaction
    .select({ id: authUsers.id, role: authUsers.role })
    .from(authUsers)
    .where(eq(authUsers.email, actor.email))
    .limit(1);
  const authenticationSubject =
    existingAuthUser?.id ??
    (
      await auth.api.createUser({
        body: {
          email: actor.email,
          name: `${actor.givenName} ${actor.familyName}`,
          password: randomBytes(32).toString("base64url"),
          role: actor.role === "registrar" ? "admin" : "user",
        },
      })
    ).user.id;

  if (existing) {
    if (existing.authenticationSubject !== authenticationSubject) {
      await transaction
        .update(userAccounts)
        .set({ authenticationSubject })
        .where(eq(userAccounts.id, existing.id));
    }
    if (existingAuthUser && actor.role === "registrar" && existingAuthUser.role !== "admin") {
      await transaction
        .update(authUsers)
        .set({ role: "admin" })
        .where(eq(authUsers.id, existingAuthUser.id));
    }
    return existing.id;
  }

  const [created] = await transaction
    .insert(userAccounts)
    .values({ personId, authenticationSubject })
    .returning({ id: userAccounts.id });

  return created.id;
}

async function getOrCreateRole(
  transaction: RlsTransaction,
  code: string,
  description: string,
) {
  const [existing] = await transaction
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.code, code))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const [created] = await transaction
    .insert(roles)
    .values({ code, description })
    .returning({ id: roles.id });

  return created.id;
}

async function getOrCreatePermission(
  transaction: RlsTransaction,
  code: string,
  description: string,
) {
  const [existing] = await transaction
    .select({ id: permissions.id })
    .from(permissions)
    .where(eq(permissions.code, code))
    .limit(1);

  if (existing) {
    return existing.id;
  }

  const [created] = await transaction
    .insert(permissions)
    .values({ code, description })
    .returning({ id: permissions.id });

  return created.id;
}

export async function seedDevelopmentData() {
  const { db, pool } = createDatabase();

  try {
    const result = await db.transaction(async (transaction) => {
      const roleIds = new Map<string, string>();
      for (const [code, description] of demoRoles) {
        roleIds.set(
          code,
          await getOrCreateRole(transaction, code, description),
        );
      }

      const permissionIds = new Map<string, string>();
      for (const [code, description] of demoPermissions) {
        permissionIds.set(
          code,
          await getOrCreatePermission(transaction, code, description),
        );
      }

      const accountIds = new Map<string, string>();
      const studentIds: string[] = [];
      let facultyEmployeeId = "";
      let counselorEmployeeId = "";

      for (const actor of demoActors) {
        const personId = await getOrCreatePerson(transaction, actor);
        const accountId = await getOrCreateAccount(
          transaction,
          personId,
          actor,
        );
        accountIds.set(actor.key, accountId);

        const roleId = roleIds.get(actor.role);
        if (!roleId) {
          throw new Error(`Missing role ${actor.role}`);
        }
        await transaction
          .insert(userRoles)
          .values({ userAccountId: accountId, roleId })
          .onConflictDoNothing();

        if (actor.employeeNumber) {
          const [existingEmployee] = await transaction
            .select({ id: employees.id })
            .from(employees)
            .where(eq(employees.employeeNumber, actor.employeeNumber))
            .limit(1);
          const employeeId =
            existingEmployee?.id ??
            (
              await transaction
                .insert(employees)
                .values({ personId, employeeNumber: actor.employeeNumber })
                .returning({ id: employees.id })
            )[0].id;

          if (actor.role === "faculty") {
            facultyEmployeeId = employeeId;
          } else if (actor.role === "counselor") {
            counselorEmployeeId = employeeId;
          }
        }

        if (actor.studentNumber) {
          const [existingStudent] = await transaction
            .select({ id: students.id })
            .from(students)
            .where(eq(students.institutionalStudentNumber, actor.studentNumber))
            .limit(1);
          const studentId =
            existingStudent?.id ??
            (
              await transaction
                .insert(students)
                .values({
                  personId,
                  institutionalStudentNumber: actor.studentNumber,
                  admissionDate: "2026-06-01",
                })
                .returning({ id: students.id })
            )[0].id;
          studentIds.push(studentId);
        }
      }

      for (const [roleCode, permissionCode] of [
        ["student", "student:dashboard"],
        ["student", "student:support-signal"],
        ["faculty", "faculty:attendance"],
        ["faculty", "faculty:grades"],
        ["counselor", "counselor:support-queue"],
        ["registrar", "auth:provision"],
        ["admin", "auth:provision"],
      ]) {
        await transaction
          .insert(rolePermissions)
          .values({
            roleId: requireSeedValue(roleIds, roleCode),
            permissionId: requireSeedValue(permissionIds, permissionCode),
          })
          .onConflictDoNothing();
      }

      const [term] = await transaction
        .select({ id: academicTerms.id })
        .from(academicTerms)
        .where(eq(academicTerms.code, "2026-2027-FIRST"))
        .limit(1);
      const termId =
        term?.id ??
        (
          await transaction
            .insert(academicTerms)
            .values({
              code: "2026-2027-FIRST",
              academicYear: "2026-2027",
              kind: "first_semester",
              startsOn: "2026-06-01",
              endsOn: "2026-10-31",
              enrollmentOpensAt: new Date("2026-05-01T00:00:00Z"),
            })
            .returning({ id: academicTerms.id })
        )[0].id;

      const courseIds = new Map<string, string>();
      for (const course of [
        ["CS101", "Introduction to Computing", 3],
        ["MATH101", "College Algebra", 3],
      ] as const) {
        const [existingCourse] = await transaction
          .select({ id: courses.id })
          .from(courses)
          .where(eq(courses.code, course[0]))
          .limit(1);
        const courseId =
          existingCourse?.id ??
          (
            await transaction
              .insert(courses)
              .values({
                code: course[0],
                title: course[1],
                creditUnits: course[2],
              })
              .returning({ id: courses.id })
          )[0].id;
        courseIds.set(course[0], courseId);
      }

      const sectionIds: string[] = [];
      for (const [courseCode, sectionCode] of [
        ["CS101", "A"],
        ["MATH101", "A"],
      ] as const) {
        const courseId = requireSeedValue(courseIds, courseCode);
        const [existingSection] = await transaction
          .select({ id: sections.id })
          .from(sections)
          .where(
            and(
              eq(sections.courseId, courseId),
              eq(sections.termId, termId),
              eq(sections.sectionCode, sectionCode),
            ),
          )
          .limit(1);
        const sectionId =
          existingSection?.id ??
          (
            await transaction
              .insert(sections)
              .values({
                courseId,
                termId,
                sectionCode,
                capacity: 50,
                status: "open",
              })
              .returning({ id: sections.id })
          )[0].id;
        sectionIds.push(sectionId);

        await transaction
          .insert(sectionInstructors)
          .values({ sectionId, employeeId: facultyEmployeeId, role: "primary" })
          .onConflictDoNothing();

        const [existingPolicy] = await transaction
          .select({ id: attendancePolicies.id })
          .from(attendancePolicies)
          .where(eq(attendancePolicies.sectionId, sectionId))
          .limit(1);
        if (!existingPolicy) {
          await transaction.insert(attendancePolicies).values({
            sectionId,
            policyVersion: "2026.1",
            allowableAbsences: 3,
            policyText:
              "Students may have up to three absences before intervention.",
            publishedAt: new Date("2026-06-01T00:00:00Z"),
          });
        }
      }

      for (const period of [
        ["prelim", 1],
        ["midterm", 2],
        ["final", 3],
      ] as const) {
        await transaction
          .insert(gradePeriods)
          .values({ code: period[0], sequence: period[1] })
          .onConflictDoNothing();
      }

      for (const studentId of studentIds) {
        for (const sectionId of sectionIds) {
          const [existingEnrollment] = await transaction
            .select({ id: enrollments.id })
            .from(enrollments)
            .where(
              and(
                eq(enrollments.studentId, studentId),
                eq(enrollments.sectionId, sectionId),
              ),
            )
            .limit(1);
          if (!existingEnrollment) {
            await transaction.insert(enrollments).values({
              studentId,
              sectionId,
              status: "enrolled",
            });
          }
        }
      }

      const [privacyPolicy] = await transaction
        .select({ id: privacyPolicies.id })
        .from(privacyPolicies)
        .where(eq(privacyPolicies.version, "2026.1"))
        .limit(1);
      if (!privacyPolicy) {
        await transaction.insert(privacyPolicies).values({
          version: "2026.1",
          title: "ARISE Demo Privacy Policy",
          body: "Demo consent for cross-departmental academic records and confidential student support signaling.",
          effectiveAt: new Date("2026-06-01T00:00:00Z"),
        });
      }

      for (const studentId of studentIds) {
        const [existingAssignment] = await transaction
          .select({ id: counselorAssignments.id })
          .from(counselorAssignments)
          .where(
            and(
              eq(counselorAssignments.studentId, studentId),
              eq(counselorAssignments.counselorEmployeeId, counselorEmployeeId),
            ),
          )
          .limit(1);
        if (!existingAssignment) {
          await transaction.insert(counselorAssignments).values({
            studentId,
            counselorEmployeeId,
            effectiveFrom: new Date("2026-06-01T00:00:00Z"),
            assignedByUserAccountId: requireSeedValue(accountIds, "counselor"),
          });
        }
      }

      for (const [
        code,
        name,
        description,
        thresholdValue,
        thresholdUnit,
      ] of riskDefaults) {
        const [definition] = await transaction
          .select({ id: riskRuleDefinitions.id })
          .from(riskRuleDefinitions)
          .where(eq(riskRuleDefinitions.code, code))
          .limit(1);
        const definitionId =
          definition?.id ??
          (
            await transaction
              .insert(riskRuleDefinitions)
              .values({ code, name, description })
              .returning({ id: riskRuleDefinitions.id })
          )[0].id;
        await transaction
          .insert(riskRuleVersions)
          .values({
            ruleDefinitionId: definitionId,
            version: 1,
            thresholdValue,
            thresholdUnit,
            activeFrom: new Date("2026-06-01T00:00:00Z"),
          })
          .onConflictDoNothing();
      }

      return {
        accountIds: Object.fromEntries(accountIds),
        sectionIds,
      };
    });

    console.log("ARISE development data seeded.");
    console.log(`Faculty actor ID: ${result.accountIds.faculty}`);
    console.log(`Counselor actor ID: ${result.accountIds.counselor}`);
    console.log(`Registrar actor ID: ${result.accountIds.registrar}`);
    for (const actor of demoActors.filter((item) => item.role === "student")) {
      console.log(`${actor.key} actor ID: ${result.accountIds[actor.key]}`);
    }
    return result;
  } finally {
    await pool.end();
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  void seedDevelopmentData().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
