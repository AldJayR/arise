import { and, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import type { RlsTransaction } from "@/db/client";
import {
  counselorAssignments,
  persons,
  students,
  supportSignals,
} from "@/db/schema";
import { type Actor, requireActorRole } from "@/server/auth/actor";
import { forbidden, notFound } from "@/server/http/errors";
import { recordAuditEvent } from "@/server/services/audit";
import { requireActorPermission } from "@/server/services/authorization";
import { requireStudentConsent } from "@/server/services/consent";
import {
  appendInitialCaseStatus,
  createAssignedCase,
} from "@/server/services/interventions";
import type { SupportSignalInput } from "@/server/validation/student";

function requireStudent(actor: Actor) {
  requireActorRole(actor, "student");
  if (!actor.studentId) {
    throw forbidden("The student actor has no student identity");
  }
  return actor.studentId;
}

export async function createSupportSignal(
  transaction: RlsTransaction,
  actor: Actor,
  _input: SupportSignalInput,
) {
  const studentId = requireStudent(actor);
  requireActorPermission(actor, "student:support-signal");
  await requireStudentConsent(transaction, studentId, [
    "confidential_support_signal",
  ]);

  const [assignment] = await transaction
    .select({ counselorEmployeeId: counselorAssignments.counselorEmployeeId })
    .from(counselorAssignments)
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
  if (!assignment) {
    throw notFound("No active counselor assignment exists");
  }

  const [signal] = await transaction
    .insert(supportSignals)
    .values({
      studentId,
      recipientCounselorEmployeeId: assignment.counselorEmployeeId,
    })
    .returning({
      id: supportSignals.id,
      studentId: supportSignals.studentId,
      recipientCounselorEmployeeId: supportSignals.recipientCounselorEmployeeId,
      submittedAt: supportSignals.submittedAt,
      status: supportSignals.status,
    });

  const caseRow = await createAssignedCase(transaction, actor, {
    studentId,
    assignedCounselorEmployeeId: assignment.counselorEmployeeId,
    source: "support_signal",
    sourceSupportSignalId: signal.id,
  });
  await appendInitialCaseStatus(transaction, actor, caseRow);

  await recordAuditEvent(transaction, {
    actor,
    action: "insert",
    targetSchema: "services",
    targetTable: "support_signals",
    targetRecordId: signal.id,
    targetStudentId: studentId,
    metadata: { recipientCounselorEmployeeId: assignment.counselorEmployeeId },
  });

  return {
    id: signal.id,
    caseId: caseRow.id,
    status: signal.status,
    submittedAt: signal.submittedAt.toISOString(),
  };
}

export async function listCounselorSupportSignals(
  transaction: RlsTransaction,
  actor: Actor,
) {
  requireActorRole(actor, "counselor");
  requireActorPermission(actor, "counselor:support-queue");
  if (!actor.employeeId) {
    throw forbidden("The counselor actor has no employee identity");
  }

  const signals = await transaction
    .select({
      id: supportSignals.id,
      studentId: students.id,
      studentNumber: students.institutionalStudentNumber,
      studentName: persons.displayName,
      submittedAt: supportSignals.submittedAt,
      status: supportSignals.status,
    })
    .from(supportSignals)
    .innerJoin(students, eq(students.id, supportSignals.studentId))
    .innerJoin(persons, eq(persons.id, students.personId))
    .where(
      and(
        eq(supportSignals.recipientCounselorEmployeeId, actor.employeeId),
        inArray(supportSignals.status, ["pending", "acknowledged"]),
      ),
    )
    .orderBy(desc(supportSignals.submittedAt));

  return {
    signals: signals.map((signal) => ({
      ...signal,
      submittedAt: signal.submittedAt.toISOString(),
    })),
  };
}
