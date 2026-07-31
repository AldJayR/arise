import { and, asc, desc, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import type { RlsTransaction } from "@/db/client";
import {
  academicTerms,
  attendancePolicies,
  attendanceRecords,
  classSessions,
  counselorAssignments,
  courses,
  employees,
  enrollments,
  gradePeriods,
  gradeRecords,
  persons,
  sections,
} from "@/db/schema";
import { type Actor, requireActorRole } from "@/server/auth/actor";
import { forbidden, notFound } from "@/server/http/errors";
import { requireActorPermission } from "@/server/services/authorization";
import { requireStudentConsent } from "@/server/services/consent";
import { getCurrentRiskSummaries } from "@/server/services/risk";

function requireStudent(actor: Actor) {
  requireActorRole(actor, "student");
  if (!actor.studentId) {
    throw forbidden("The student actor has no student identity");
  }
  return actor.studentId;
}

function gradeTrend(
  grades: Array<{ period: "prelim" | "midterm" | "final"; value: number }>,
) {
  const ordered = ["prelim", "midterm", "final"] as const;
  const numericGrades = ordered
    .map((period) => grades.find((grade) => grade.period === period))
    .filter(
      (grade): grade is { period: (typeof ordered)[number]; value: number } =>
        grade !== undefined,
    );
  if (numericGrades.length < 2) {
    return null;
  }

  const previous = numericGrades[numericGrades.length - 2].value;
  const current = numericGrades[numericGrades.length - 1].value;
  return current < previous
    ? "improving"
    : current > previous
      ? "declining"
      : "stable";
}

export async function getStudentDashboard(
  transaction: RlsTransaction,
  actor: Actor,
) {
  const studentId = requireStudent(actor);
  requireActorPermission(actor, "student:dashboard");
  await requireStudentConsent(transaction, studentId, [
    "cross_departmental_records",
  ]);
  const riskSummary = (
    await getCurrentRiskSummaries(transaction, [studentId])
  ).get(studentId) ?? { severity: "green" as const, signalCount: 0 };

  const subjects = await transaction
    .select({
      enrollmentId: enrollments.id,
      sectionId: sections.id,
      courseCode: courses.code,
      courseTitle: courses.title,
      sectionCode: sections.sectionCode,
      allowableAbsences: attendancePolicies.allowableAbsences,
      absenceCount: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'absent')::int`,
      totalSessions: sql<number>`count(distinct ${classSessions.id})::int`,
    })
    .from(enrollments)
    .innerJoin(sections, eq(sections.id, enrollments.sectionId))
    .innerJoin(courses, eq(courses.id, sections.courseId))
    .innerJoin(academicTerms, eq(academicTerms.id, sections.termId))
    .innerJoin(
      attendancePolicies,
      eq(attendancePolicies.sectionId, sections.id),
    )
    .leftJoin(classSessions, eq(classSessions.sectionId, sections.id))
    .leftJoin(
      attendanceRecords,
      eq(attendanceRecords.sessionId, classSessions.id),
    )
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.status, "enrolled"),
        sql`${academicTerms.startsOn} <= CURRENT_DATE`,
        sql`${academicTerms.endsOn} >= CURRENT_DATE`,
      ),
    )
    .groupBy(
      enrollments.id,
      sections.id,
      courses.code,
      courses.title,
      sections.sectionCode,
      attendancePolicies.allowableAbsences,
    )
    .orderBy(asc(courses.code));

  const subjectIds = subjects.map((subject) => subject.enrollmentId);
  const history = subjectIds.length
    ? await transaction
        .select({
          enrollmentId: enrollments.id,
          courseCode: courses.code,
          sessionId: classSessions.id,
          sessionSequence: classSessions.sessionSequence,
          startsAt: classSessions.startsAt,
          type: classSessions.type,
          status: attendanceRecords.status,
        })
        .from(attendanceRecords)
        .innerJoin(
          classSessions,
          eq(classSessions.id, attendanceRecords.sessionId),
        )
        .innerJoin(
          enrollments,
          eq(enrollments.id, attendanceRecords.enrollmentId),
        )
        .innerJoin(sections, eq(sections.id, enrollments.sectionId))
        .innerJoin(courses, eq(courses.id, sections.courseId))
        .where(inStudentEnrollments(subjectIds))
        .orderBy(desc(classSessions.startsAt))
    : [];

  const gradeRows = subjectIds.length
    ? await transaction
        .select({
          enrollmentId: enrollments.id,
          courseCode: courses.code,
          period: gradePeriods.code,
          markKind: gradeRecords.markKind,
          numericValue: gradeRecords.numericValue,
        })
        .from(gradeRecords)
        .innerJoin(enrollments, eq(enrollments.id, gradeRecords.enrollmentId))
        .innerJoin(sections, eq(sections.id, enrollments.sectionId))
        .innerJoin(courses, eq(courses.id, sections.courseId))
        .innerJoin(
          gradePeriods,
          eq(gradePeriods.id, gradeRecords.gradePeriodId),
        )
        .where(inStudentEnrollments(subjectIds))
        .orderBy(asc(gradePeriods.sequence))
    : [];

  const counselor = await transaction
    .select({
      displayName: persons.displayName,
      institutionalEmail: persons.institutionalEmail,
      phoneE164: persons.phoneE164,
      employeeNumber: employees.employeeNumber,
    })
    .from(counselorAssignments)
    .innerJoin(
      employees,
      eq(employees.id, counselorAssignments.counselorEmployeeId),
    )
    .innerJoin(persons, eq(persons.id, employees.personId))
    .where(
      and(
        eq(counselorAssignments.studentId, studentId),
        lte(counselorAssignments.effectiveFrom, new Date()),
        or(
          isNull(counselorAssignments.effectiveUntil),
          gt(counselorAssignments.effectiveUntil, new Date()),
        ),
      ),
    )
    .orderBy(desc(counselorAssignments.effectiveFrom))
    .limit(1);

  if (!counselor[0]) {
    throw notFound("No active counselor assignment exists");
  }

  const gradesByEnrollment = new Map<string, typeof gradeRows>();
  for (const grade of gradeRows) {
    const current = gradesByEnrollment.get(grade.enrollmentId) ?? [];
    current.push(grade);
    gradesByEnrollment.set(grade.enrollmentId, current);
  }

  return {
    status: riskSummary.severity,
    risk: riskSummary,
    subjects: subjects.map((subject) => {
      const subjectGrades = gradesByEnrollment.get(subject.enrollmentId) ?? [];
      const numericGrades = subjectGrades.flatMap((grade) =>
        grade.markKind === "numeric" && grade.numericValue !== null
          ? [{ period: grade.period, value: grade.numericValue }]
          : [],
      );
      return {
        enrollmentId: subject.enrollmentId,
        sectionId: subject.sectionId,
        courseCode: subject.courseCode,
        courseTitle: subject.courseTitle,
        sectionCode: subject.sectionCode,
        attendance: {
          absenceCount: subject.absenceCount,
          allowableAbsences: subject.allowableAbsences,
          remainingAbsences: Math.max(
            subject.allowableAbsences - subject.absenceCount,
            0,
          ),
          usagePercentage:
            subject.allowableAbsences === 0
              ? subject.absenceCount > 0
                ? 100
                : 0
              : (subject.absenceCount / subject.allowableAbsences) * 100,
          totalSessions: subject.totalSessions,
          history: history
            .filter((entry) => entry.enrollmentId === subject.enrollmentId)
            .map((entry) => ({
              sessionId: entry.sessionId,
              sessionSequence: entry.sessionSequence,
              startsAt: entry.startsAt.toISOString(),
              type: entry.type,
              status: entry.status,
            })),
        },
        grades: subjectGrades.map((grade) => ({
          period: grade.period,
          markKind: grade.markKind,
          numericValue: grade.numericValue,
        })),
        trend: gradeTrend(numericGrades),
      };
    }),
    counselor: {
      name: counselor[0].displayName,
      institutionalEmail: counselor[0].institutionalEmail,
      phoneE164: counselor[0].phoneE164,
      employeeNumber: counselor[0].employeeNumber,
    },
  };
}

function inStudentEnrollments(enrollmentIds: string[]) {
  return sql`${enrollments.id} IN (${sql.join(
    enrollmentIds.map((enrollmentId) => sql`${enrollmentId}`),
    sql`, `,
  )})`;
}
