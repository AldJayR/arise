import { and, asc, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import type { RlsTransaction } from "@/db/client";
import {
  caseStatusHistory,
  cases,
  counselorAssignments,
  counselorReferrals,
  enrollments,
  interventionNotes,
  persons,
  referralStatusHistory,
  sectionInstructors,
  sections,
  students,
} from "@/db/schema";
import { type Actor, requireActorRole } from "@/server/auth/actor";
import { badRequest, forbidden, notFound } from "@/server/http/errors";
import { recordAuditEvent } from "@/server/services/audit";
import { requireActorPermission } from "@/server/services/authorization";
import type {
  CaseStatusInput,
  InterventionNoteInput,
  ReferralInput,
} from "@/server/validation/interventions";

type CaseStatus = "pending" | "contacted" | "responded" | "resolved";

function requireFacultyEmployee(actor: Actor) {
  requireActorRole(actor, "faculty");
  if (!actor.employeeId) {
    throw forbidden("The faculty actor has no employee identity");
  }
  return actor.employeeId;
}

function requireCounselorEmployee(actor: Actor) {
  requireActorRole(actor, "counselor");
  if (!actor.employeeId) {
    throw forbidden("The counselor actor has no employee identity");
  }
  return actor.employeeId;
}

async function getFacultySection(
  transaction: RlsTransaction,
  employeeId: string,
  sectionId: string,
) {
  const [section] = await transaction
    .select({ id: sections.id })
    .from(sections)
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

  const [existing] = await transaction
    .select({ id: sections.id })
    .from(sections)
    .where(eq(sections.id, sectionId))
    .limit(1);
  if (!existing) {
    throw notFound("Section not found");
  }

  throw forbidden("The faculty actor is not assigned to this section");
}

async function requireEnrolledStudent(
  transaction: RlsTransaction,
  sectionId: string,
  studentId: string,
) {
  const [enrollment] = await transaction
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.sectionId, sectionId),
        eq(enrollments.studentId, studentId),
        eq(enrollments.status, "enrolled"),
      ),
    )
    .limit(1);

  if (!enrollment) {
    throw badRequest("The student is not enrolled in this section");
  }
}

async function resolveActiveCounselor(
  transaction: RlsTransaction,
  studentId: string,
) {
  const now = new Date();
  const [assignment] = await transaction
    .select({ counselorEmployeeId: counselorAssignments.counselorEmployeeId })
    .from(counselorAssignments)
    .where(
      and(
        eq(counselorAssignments.studentId, studentId),
        lte(counselorAssignments.effectiveFrom, now),
        or(
          isNull(counselorAssignments.effectiveUntil),
          gt(counselorAssignments.effectiveUntil, now),
        ),
      ),
    )
    .orderBy(desc(counselorAssignments.effectiveFrom))
    .limit(1);

  if (!assignment) {
    throw notFound("No active counselor assignment exists");
  }

  return assignment.counselorEmployeeId;
}

export async function createAssignedCase(
  transaction: RlsTransaction,
  actor: Actor,
  input: {
    studentId: string;
    assignedCounselorEmployeeId: string;
    source: "support_signal" | "faculty_referral";
    sourceSupportSignalId?: string;
  },
) {
  const [caseRow] = await transaction
    .insert(cases)
    .values({
      studentId: input.studentId,
      assignedCounselorEmployeeId: input.assignedCounselorEmployeeId,
      source: input.source,
      sourceSupportSignalId: input.sourceSupportSignalId,
    })
    .returning({
      id: cases.id,
      studentId: cases.studentId,
      assignedCounselorEmployeeId: cases.assignedCounselorEmployeeId,
      source: cases.source,
      openedAt: cases.openedAt,
    });

  await recordAuditEvent(transaction, {
    actor,
    action: "insert",
    targetSchema: "services",
    targetTable: "cases",
    targetRecordId: caseRow.id,
    targetStudentId: caseRow.studentId,
    metadata: {
      source: caseRow.source,
      assignedCounselorEmployeeId: caseRow.assignedCounselorEmployeeId,
    },
  });

  return caseRow;
}

export async function appendInitialCaseStatus(
  transaction: RlsTransaction,
  actor: Actor,
  caseRow: {
    id: string;
    studentId: string;
    assignedCounselorEmployeeId: string | null;
  },
) {
  if (!caseRow.assignedCounselorEmployeeId) {
    throw notFound("No active counselor assignment exists");
  }

  const [statusRow] = await transaction
    .insert(caseStatusHistory)
    .values({
      caseId: caseRow.id,
      status: "pending",
      changedByEmployeeId: caseRow.assignedCounselorEmployeeId,
    })
    .returning({ id: caseStatusHistory.id });

  await recordAuditEvent(transaction, {
    actor,
    action: "insert",
    targetSchema: "services",
    targetTable: "case_status_history",
    targetRecordId: statusRow.id,
    targetStudentId: caseRow.studentId,
    metadata: { caseId: caseRow.id, status: "pending" },
  });
}

export async function createFacultyReferral(
  transaction: RlsTransaction,
  actor: Actor,
  sectionId: string,
  input: ReferralInput,
) {
  requireActorPermission(actor, "faculty:referrals");
  const employeeId = requireFacultyEmployee(actor);
  await getFacultySection(transaction, employeeId, sectionId);
  await requireEnrolledStudent(transaction, sectionId, input.studentId);
  const counselorEmployeeId = await resolveActiveCounselor(
    transaction,
    input.studentId,
  );

  const [referral] = await transaction
    .insert(counselorReferrals)
    .values({
      studentId: input.studentId,
      referredByEmployeeId: employeeId,
      sectionId,
      contextualNote: input.contextualNote ?? null,
    })
    .returning({
      id: counselorReferrals.id,
      studentId: counselorReferrals.studentId,
      createdAt: counselorReferrals.createdAt,
    });

  await recordAuditEvent(transaction, {
    actor,
    action: "insert",
    targetSchema: "services",
    targetTable: "counselor_referrals",
    targetRecordId: referral.id,
    targetStudentId: referral.studentId,
    metadata: { sectionId },
  });

  const caseRow = await createAssignedCase(transaction, actor, {
    studentId: input.studentId,
    assignedCounselorEmployeeId: counselorEmployeeId,
    source: "faculty_referral",
  });

  await transaction
    .update(counselorReferrals)
    .set({ caseId: caseRow.id })
    .where(eq(counselorReferrals.id, referral.id));

  await recordAuditEvent(transaction, {
    actor,
    action: "update",
    targetSchema: "services",
    targetTable: "counselor_referrals",
    targetRecordId: referral.id,
    targetStudentId: referral.studentId,
    metadata: { caseId: caseRow.id },
  });

  await appendInitialCaseStatus(transaction, actor, caseRow);

  const [referralStatus] = await transaction
    .insert(referralStatusHistory)
    .values({
      referralId: referral.id,
      status: "pending",
      changedByEmployeeId: employeeId,
    })
    .returning({ id: referralStatusHistory.id });

  await recordAuditEvent(transaction, {
    actor,
    action: "insert",
    targetSchema: "services",
    targetTable: "referral_status_history",
    targetRecordId: referralStatus.id,
    targetStudentId: referral.studentId,
    metadata: { referralId: referral.id, status: "pending" },
  });

  return {
    id: referral.id,
    caseId: caseRow.id,
    status: "pending" as const,
    createdAt: referral.createdAt.toISOString(),
  };
}

export async function listFacultyReferrals(
  transaction: RlsTransaction,
  actor: Actor,
) {
  requireActorPermission(actor, "faculty:referral-tracking");
  const employeeId = requireFacultyEmployee(actor);
  const referrals = await transaction
    .select({
      id: counselorReferrals.id,
      studentId: students.id,
      studentNumber: students.institutionalStudentNumber,
      studentName: persons.displayName,
      sectionId: counselorReferrals.sectionId,
      referredAt: counselorReferrals.createdAt,
    })
    .from(counselorReferrals)
    .innerJoin(students, eq(students.id, counselorReferrals.studentId))
    .innerJoin(persons, eq(persons.id, students.personId))
    .where(eq(counselorReferrals.referredByEmployeeId, employeeId))
    .orderBy(desc(counselorReferrals.createdAt));

  if (referrals.length === 0) {
    return { referrals: [] };
  }

  const referralIds = referrals.map((referral) => referral.id);
  const statusRows = await transaction
    .select({
      referralId: referralStatusHistory.referralId,
      status: referralStatusHistory.status,
      changedAt: referralStatusHistory.changedAt,
    })
    .from(referralStatusHistory)
    .where(inArray(referralStatusHistory.referralId, referralIds))
    .orderBy(desc(referralStatusHistory.changedAt));
  const latestStatuses = new Map<
    string,
    (typeof statusRows)[number]["status"]
  >();
  for (const status of statusRows) {
    if (!latestStatuses.has(status.referralId)) {
      latestStatuses.set(status.referralId, status.status);
    }
  }

  return {
    referrals: referrals.map((referral) => ({
      id: referral.id,
      student: {
        id: referral.studentId,
        studentNumber: referral.studentNumber,
        displayName: referral.studentName,
      },
      sectionId: referral.sectionId,
      referredAt: referral.referredAt.toISOString(),
      status: latestStatuses.get(referral.id) ?? "pending",
    })),
  };
}

async function getAssignedCase(
  transaction: RlsTransaction,
  employeeId: string,
  caseId: string,
) {
  const [caseRow] = await transaction
    .select({
      id: cases.id,
      studentId: cases.studentId,
      assignedCounselorEmployeeId: cases.assignedCounselorEmployeeId,
      source: cases.source,
      openedAt: cases.openedAt,
      studentNumber: students.institutionalStudentNumber,
      studentName: persons.displayName,
    })
    .from(cases)
    .innerJoin(students, eq(students.id, cases.studentId))
    .innerJoin(persons, eq(persons.id, students.personId))
    .where(
      and(
        eq(cases.id, caseId),
        eq(cases.assignedCounselorEmployeeId, employeeId),
      ),
    )
    .limit(1);

  if (!caseRow) {
    throw notFound("Case not found");
  }

  return caseRow;
}

async function getLatestCaseStatuses(
  transaction: RlsTransaction,
  caseIds: string[],
) {
  if (caseIds.length === 0) {
    return new Map<string, CaseStatus>();
  }

  const rows = await transaction
    .select({
      caseId: caseStatusHistory.caseId,
      status: caseStatusHistory.status,
      changedAt: caseStatusHistory.changedAt,
    })
    .from(caseStatusHistory)
    .where(inArray(caseStatusHistory.caseId, caseIds))
    .orderBy(desc(caseStatusHistory.changedAt));
  const latest = new Map<string, CaseStatus>();
  for (const row of rows) {
    if (!latest.has(row.caseId)) {
      latest.set(row.caseId, row.status);
    }
  }
  return latest;
}

export async function listCounselorCases(
  transaction: RlsTransaction,
  actor: Actor,
  status?: CaseStatus,
) {
  requireActorPermission(actor, "counselor:cases");
  const employeeId = requireCounselorEmployee(actor);
  const rows = await transaction
    .select({
      id: cases.id,
      source: cases.source,
      studentId: students.id,
      studentNumber: students.institutionalStudentNumber,
      studentName: persons.displayName,
      openedAt: cases.openedAt,
    })
    .from(cases)
    .innerJoin(students, eq(students.id, cases.studentId))
    .innerJoin(persons, eq(persons.id, students.personId))
    .where(eq(cases.assignedCounselorEmployeeId, employeeId))
    .orderBy(desc(cases.openedAt));
  const latestStatuses = await getLatestCaseStatuses(
    transaction,
    rows.map((row) => row.id),
  );

  return {
    cases: rows.flatMap((row) => {
      const currentStatus = latestStatuses.get(row.id) ?? "pending";
      if (status && currentStatus !== status) {
        return [];
      }
      return [
        {
          id: row.id,
          source: row.source,
          student: {
            id: row.studentId,
            studentNumber: row.studentNumber,
            displayName: row.studentName,
          },
          openedAt: row.openedAt.toISOString(),
          status: currentStatus,
        },
      ];
    }),
  };
}

export async function getCounselorCase(
  transaction: RlsTransaction,
  actor: Actor,
  caseId: string,
) {
  requireActorPermission(actor, "counselor:cases");
  const employeeId = requireCounselorEmployee(actor);
  const caseRow = await getAssignedCase(transaction, employeeId, caseId);
  const [statuses, notes] = await Promise.all([
    transaction
      .select({
        id: caseStatusHistory.id,
        status: caseStatusHistory.status,
        changedByEmployeeId: caseStatusHistory.changedByEmployeeId,
        changedAt: caseStatusHistory.changedAt,
      })
      .from(caseStatusHistory)
      .where(eq(caseStatusHistory.caseId, caseId))
      .orderBy(asc(caseStatusHistory.changedAt)),
    transaction
      .select({
        id: interventionNotes.id,
        authorEmployeeId: interventionNotes.authorEmployeeId,
        note: interventionNotes.note,
        recordedAt: interventionNotes.recordedAt,
      })
      .from(interventionNotes)
      .where(eq(interventionNotes.caseId, caseId))
      .orderBy(asc(interventionNotes.recordedAt)),
  ]);

  return {
    id: caseRow.id,
    source: caseRow.source,
    student: {
      id: caseRow.studentId,
      studentNumber: caseRow.studentNumber,
      displayName: caseRow.studentName,
    },
    openedAt: caseRow.openedAt.toISOString(),
    status: statuses.at(-1)?.status ?? "pending",
    statusHistory: statuses.map((item) => ({
      id: item.id,
      status: item.status,
      changedByEmployeeId: item.changedByEmployeeId,
      changedAt: item.changedAt.toISOString(),
    })),
    interventionNotes: notes.map((item) => ({
      id: item.id,
      authorEmployeeId: item.authorEmployeeId,
      note: item.note,
      recordedAt: item.recordedAt.toISOString(),
    })),
  };
}

function referralStatusForCaseStatus(status: CaseStatus) {
  return status === "resolved"
    ? "resolved"
    : status === "pending"
      ? "pending"
      : "contacted";
}

export async function appendCaseStatus(
  transaction: RlsTransaction,
  actor: Actor,
  caseId: string,
  input: CaseStatusInput,
) {
  requireActorPermission(actor, "counselor:cases");
  const employeeId = requireCounselorEmployee(actor);
  const caseRow = await getAssignedCase(transaction, employeeId, caseId);
  const [statusRow] = await transaction
    .insert(caseStatusHistory)
    .values({
      caseId,
      status: input.status,
      changedByEmployeeId: employeeId,
    })
    .returning({ id: caseStatusHistory.id });

  await recordAuditEvent(transaction, {
    actor,
    action: "insert",
    targetSchema: "services",
    targetTable: "case_status_history",
    targetRecordId: statusRow.id,
    targetStudentId: caseRow.studentId,
    metadata: { caseId, status: input.status },
  });

  const [referral] = await transaction
    .select({ id: counselorReferrals.id })
    .from(counselorReferrals)
    .where(eq(counselorReferrals.caseId, caseId))
    .limit(1);
  if (referral) {
    const [referralStatus] = await transaction
      .insert(referralStatusHistory)
      .values({
        referralId: referral.id,
        status: referralStatusForCaseStatus(input.status),
        changedByEmployeeId: employeeId,
      })
      .returning({ id: referralStatusHistory.id });

    await recordAuditEvent(transaction, {
      actor,
      action: "insert",
      targetSchema: "services",
      targetTable: "referral_status_history",
      targetRecordId: referralStatus.id,
      targetStudentId: caseRow.studentId,
      metadata: { referralId: referral.id, status: input.status },
    });
  }

  return {
    id: statusRow.id,
    caseId,
    status: input.status,
  };
}

export async function addInterventionNote(
  transaction: RlsTransaction,
  actor: Actor,
  caseId: string,
  input: InterventionNoteInput,
) {
  requireActorPermission(actor, "counselor:intervention-notes");
  const employeeId = requireCounselorEmployee(actor);
  const caseRow = await getAssignedCase(transaction, employeeId, caseId);
  const [note] = await transaction
    .insert(interventionNotes)
    .values({
      caseId,
      authorEmployeeId: employeeId,
      note: input.note,
    })
    .returning({
      id: interventionNotes.id,
      note: interventionNotes.note,
      recordedAt: interventionNotes.recordedAt,
    });

  await recordAuditEvent(transaction, {
    actor,
    action: "insert",
    targetSchema: "services",
    targetTable: "intervention_notes",
    targetRecordId: note.id,
    targetStudentId: caseRow.studentId,
    metadata: { caseId },
  });

  return {
    id: note.id,
    caseId,
    note: note.note,
    recordedAt: note.recordedAt.toISOString(),
  };
}
