import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { RlsTransaction } from "@/db/client";
import {
  academicTerms,
  attendancePolicies,
  attendanceRecords,
  classSessions,
  courses,
  enrollments,
  gradePeriods,
  gradeRecords,
  persons,
  sectionInstructors,
  sections,
  students,
} from "@/db/schema";
import { type Actor, requireActorRole } from "@/server/auth/actor";
import {
  badRequest,
  conflict,
  forbidden,
  notFound,
} from "@/server/http/errors";
import { recordAuditEvent } from "@/server/services/audit";
import { requireActorPermission } from "@/server/services/authorization";
import { evaluateAndPersistStudentRisk } from "@/server/services/risk";
import type {
  BulkAttendanceSubmission,
  GradeSubmission,
  SessionCreationInput,
} from "@/server/validation/faculty";

type OwnedSection = {
  id: string;
  courseCode: string;
  courseTitle: string;
  sectionCode: string;
  termCode: string;
  status: "planned" | "open" | "closed" | "cancelled";
};

function requireFacultyEmployee(actor: Actor) {
  requireActorRole(actor, "faculty");
  if (!actor.employeeId) {
    throw forbidden("The faculty actor has no employee identity");
  }
  return actor.employeeId;
}

async function getOwnedSection(
  transaction: RlsTransaction,
  actor: Actor,
  sectionId: string,
): Promise<OwnedSection> {
  const employeeId = requireFacultyEmployee(actor);
  const [section] = await transaction
    .select({
      id: sections.id,
      courseCode: courses.code,
      courseTitle: courses.title,
      sectionCode: sections.sectionCode,
      termCode: academicTerms.code,
      status: sections.status,
    })
    .from(sections)
    .innerJoin(courses, eq(courses.id, sections.courseId))
    .innerJoin(academicTerms, eq(academicTerms.id, sections.termId))
    .innerJoin(
      sectionInstructors,
      and(
        eq(sectionInstructors.sectionId, sections.id),
        eq(sectionInstructors.employeeId, employeeId),
      ),
    )
    .where(eq(sections.id, sectionId))
    .limit(1);

  if (section) {
    return section;
  }

  const [exists] = await transaction
    .select({ id: sections.id })
    .from(sections)
    .where(eq(sections.id, sectionId))
    .limit(1);

  if (!exists) {
    throw notFound("Section not found");
  }

  throw forbidden("The faculty actor is not assigned to this section");
}

function assertDistinctIds(ids: string[], resourceName: string) {
  if (new Set(ids).size !== ids.length) {
    throw badRequest(`${resourceName} must not contain duplicate IDs`);
  }
}

export async function listFacultySections(
  transaction: RlsTransaction,
  actor: Actor,
) {
  requireActorPermission(actor, "faculty:attendance");
  const employeeId = requireFacultyEmployee(actor);
  const rows = await transaction
    .select({
      id: sections.id,
      courseCode: courses.code,
      courseTitle: courses.title,
      sectionCode: sections.sectionCode,
      termCode: academicTerms.code,
      status: sections.status,
    })
    .from(sectionInstructors)
    .innerJoin(sections, eq(sections.id, sectionInstructors.sectionId))
    .innerJoin(courses, eq(courses.id, sections.courseId))
    .innerJoin(academicTerms, eq(academicTerms.id, sections.termId))
    .where(eq(sectionInstructors.employeeId, employeeId))
    .orderBy(
      asc(academicTerms.startsOn),
      asc(courses.code),
      asc(sections.sectionCode),
    );

  return { sections: rows };
}

export async function getFacultyRoster(
  transaction: RlsTransaction,
  actor: Actor,
  sectionId: string,
) {
  requireActorPermission(actor, "faculty:attendance");
  const section = await getOwnedSection(transaction, actor, sectionId);
  const [policy] = await transaction
    .select({
      policyVersion: attendancePolicies.policyVersion,
      allowableAbsences: attendancePolicies.allowableAbsences,
      policyText: attendancePolicies.policyText,
      publishedAt: attendancePolicies.publishedAt,
    })
    .from(attendancePolicies)
    .where(eq(attendancePolicies.sectionId, sectionId))
    .limit(1);

  const studentsInSection = await transaction
    .select({
      enrollmentId: enrollments.id,
      studentId: students.id,
      studentNumber: students.institutionalStudentNumber,
      displayName: persons.displayName,
      enrollmentStatus: enrollments.status,
    })
    .from(enrollments)
    .innerJoin(students, eq(students.id, enrollments.studentId))
    .innerJoin(persons, eq(persons.id, students.personId))
    .where(eq(enrollments.sectionId, sectionId))
    .orderBy(asc(persons.displayName));

  return {
    section,
    attendancePolicy: policy
      ? {
          policyVersion: policy.policyVersion,
          allowableAbsences: policy.allowableAbsences,
          policyText: policy.policyText,
          publishedAt: policy.publishedAt.toISOString(),
        }
      : null,
    students: studentsInSection.map((student) => ({
      ...student,
      risk: { severity: null, signalCount: 0 },
    })),
  };
}

export async function createClassSession(
  transaction: RlsTransaction,
  actor: Actor,
  sectionId: string,
  input: SessionCreationInput,
) {
  requireActorPermission(actor, "faculty:attendance");
  await getOwnedSection(transaction, actor, sectionId);
  const startsAt = new Date(input.startsAt);
  const endsAt = input.endsAt ? new Date(input.endsAt) : null;

  if (endsAt && endsAt <= startsAt) {
    throw badRequest("Session end time must be after its start time");
  }

  const [existing] = await transaction
    .select({ id: classSessions.id })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.sectionId, sectionId),
        eq(classSessions.sessionSequence, input.sessionSequence),
      ),
    )
    .limit(1);
  if (existing) {
    throw conflict("A class session with this sequence already exists");
  }

  const [session] = await transaction
    .insert(classSessions)
    .values({
      sectionId,
      sessionSequence: input.sessionSequence,
      startsAt,
      endsAt,
      type: input.type,
    })
    .returning({
      id: classSessions.id,
      sectionId: classSessions.sectionId,
      sessionSequence: classSessions.sessionSequence,
      startsAt: classSessions.startsAt,
      endsAt: classSessions.endsAt,
      type: classSessions.type,
    });

  return {
    id: session.id,
    sectionId: session.sectionId,
    sessionSequence: session.sessionSequence,
    startsAt: session.startsAt.toISOString(),
    endsAt: session.endsAt?.toISOString() ?? null,
    type: session.type,
  };
}

async function validateAttendanceTarget(
  transaction: RlsTransaction,
  sectionId: string,
  sessionId: string,
  enrollmentIds: string[],
) {
  const [session] = await transaction
    .select({ id: classSessions.id })
    .from(classSessions)
    .where(
      and(
        eq(classSessions.id, sessionId),
        eq(classSessions.sectionId, sectionId),
      ),
    )
    .limit(1);
  if (!session) {
    throw notFound("Session not found in this section");
  }

  const matchingEnrollments = await transaction
    .select({ id: enrollments.id, studentId: enrollments.studentId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.sectionId, sectionId),
        inArray(enrollments.id, enrollmentIds),
      ),
    );
  if (matchingEnrollments.length !== enrollmentIds.length) {
    throw badRequest("Every attendance enrollment must belong to this section");
  }

  return matchingEnrollments;
}

export async function recordAttendance(
  transaction: RlsTransaction,
  actor: Actor,
  sectionId: string,
  input: BulkAttendanceSubmission,
) {
  requireActorPermission(actor, "faculty:attendance");
  const employeeId = requireFacultyEmployee(actor);
  await getOwnedSection(transaction, actor, sectionId);
  const enrollmentIds = input.entries.map((entry) => entry.enrollmentId);
  assertDistinctIds(enrollmentIds, "Attendance entries");
  const matchingEnrollments = await validateAttendanceTarget(
    transaction,
    sectionId,
    input.sessionId,
    enrollmentIds,
  );

  const now = new Date();
  await transaction
    .insert(attendanceRecords)
    .values(
      input.entries.map((entry) => ({
        sessionId: input.sessionId,
        enrollmentId: entry.enrollmentId,
        status: entry.status,
        source: "faculty" as const,
        recordedByEmployeeId: employeeId,
        recordedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [attendanceRecords.sessionId, attendanceRecords.enrollmentId],
      set: {
        status: sql`excluded.status`,
        source: sql`excluded.source`,
        recordedByEmployeeId: sql`excluded.recorded_by_employee_id`,
        recordedAt: sql`excluded.recorded_at`,
      },
    });

  const saved = await transaction
    .select({
      id: attendanceRecords.id,
      sessionId: attendanceRecords.sessionId,
      enrollmentId: attendanceRecords.enrollmentId,
      status: attendanceRecords.status,
      source: attendanceRecords.source,
      recordedAt: attendanceRecords.recordedAt,
    })
    .from(attendanceRecords)
    .where(
      and(
        eq(attendanceRecords.sessionId, input.sessionId),
        inArray(attendanceRecords.enrollmentId, enrollmentIds),
      ),
    );

  for (const studentId of new Set(
    matchingEnrollments.map((row) => row.studentId),
  )) {
    await evaluateAndPersistStudentRisk(transaction, studentId);
  }
  await recordAuditEvent(transaction, {
    actor,
    action: "update",
    targetSchema: "academic",
    targetTable: "attendance_records",
    targetRecordId: input.sessionId,
    metadata: { sectionId, entryCount: input.entries.length },
  });

  return {
    sectionId,
    sessionId: input.sessionId,
    entries: saved.map((entry) => ({
      ...entry,
      recordedAt: entry.recordedAt.toISOString(),
    })),
  };
}

export async function recordGrades(
  transaction: RlsTransaction,
  actor: Actor,
  sectionId: string,
  input: GradeSubmission,
) {
  requireActorPermission(actor, "faculty:grades");
  const employeeId = requireFacultyEmployee(actor);
  await getOwnedSection(transaction, actor, sectionId);
  const enrollmentIds = input.entries.map((entry) => entry.enrollmentId);
  assertDistinctIds(enrollmentIds, "Grade entries");

  const [period] = await transaction
    .select({ id: gradePeriods.id, code: gradePeriods.code })
    .from(gradePeriods)
    .where(eq(gradePeriods.id, input.gradePeriodId))
    .limit(1);
  if (!period) {
    throw notFound("Grade period not found");
  }

  const matchingEnrollments = await transaction
    .select({ id: enrollments.id, studentId: enrollments.studentId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.sectionId, sectionId),
        inArray(enrollments.id, enrollmentIds),
      ),
    );
  if (matchingEnrollments.length !== enrollmentIds.length) {
    throw badRequest("Every grade enrollment must belong to this section");
  }

  const lockedRecords = await transaction
    .select({ id: gradeRecords.id })
    .from(gradeRecords)
    .where(
      and(
        eq(gradeRecords.gradePeriodId, input.gradePeriodId),
        inArray(gradeRecords.enrollmentId, enrollmentIds),
        sql`${gradeRecords.lockedAt} IS NOT NULL`,
      ),
    );
  if (lockedRecords.length > 0) {
    throw conflict("One or more grade records are locked");
  }

  const now = new Date();
  await transaction
    .insert(gradeRecords)
    .values(
      input.entries.map((entry) => ({
        enrollmentId: entry.enrollmentId,
        gradePeriodId: input.gradePeriodId,
        markKind: entry.markKind,
        numericValue: entry.markKind === "numeric" ? entry.numericValue : null,
        submittedByEmployeeId: employeeId,
        submittedAt: now,
      })),
    )
    .onConflictDoUpdate({
      target: [gradeRecords.enrollmentId, gradeRecords.gradePeriodId],
      set: {
        markKind: sql`excluded.mark_kind`,
        numericValue: sql`excluded.numeric_value`,
        submittedByEmployeeId: sql`excluded.submitted_by_employee_id`,
        submittedAt: sql`excluded.submitted_at`,
      },
    });

  const saved = await transaction
    .select({
      id: gradeRecords.id,
      enrollmentId: gradeRecords.enrollmentId,
      gradePeriodId: gradeRecords.gradePeriodId,
      markKind: gradeRecords.markKind,
      numericValue: gradeRecords.numericValue,
      submittedAt: gradeRecords.submittedAt,
    })
    .from(gradeRecords)
    .where(
      and(
        eq(gradeRecords.gradePeriodId, input.gradePeriodId),
        inArray(gradeRecords.enrollmentId, enrollmentIds),
      ),
    );

  for (const studentId of new Set(
    matchingEnrollments.map((row) => row.studentId),
  )) {
    await evaluateAndPersistStudentRisk(transaction, studentId);
  }
  await recordAuditEvent(transaction, {
    actor,
    action: "update",
    targetSchema: "academic",
    targetTable: "grade_records",
    targetRecordId: input.gradePeriodId,
    metadata: { sectionId, entryCount: input.entries.length },
  });

  return {
    sectionId,
    gradePeriod: period,
    entries: saved.map((entry) => ({
      ...entry,
      submittedAt: entry.submittedAt.toISOString(),
    })),
  };
}
