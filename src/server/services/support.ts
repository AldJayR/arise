import { and, desc, eq, gt, inArray, isNull, lte, or } from "drizzle-orm";
import type { RlsTransaction } from "@/db/client";
import {
  consentRecords,
  counselorAssignments,
  persons,
  students,
  supportSignals,
} from "@/db/schema";
import { type Actor, requireActorRole } from "@/server/auth/actor";
import { forbidden, notFound } from "@/server/http/errors";
import { recordAuditEvent } from "@/server/services/audit";
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
  const [consent] = await transaction
    .select({ id: consentRecords.id })
    .from(consentRecords)
    .where(
      and(
        eq(consentRecords.studentId, studentId),
        eq(consentRecords.purpose, "confidential_support_signal"),
        eq(consentRecords.state, "granted"),
        isNull(consentRecords.withdrawnAt),
      ),
    )
    .limit(1);
  if (!consent) {
    throw forbidden("Confidential support consent is required");
  }

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
    status: signal.status,
    submittedAt: signal.submittedAt.toISOString(),
  };
}

export async function listCounselorSupportSignals(
  transaction: RlsTransaction,
  actor: Actor,
) {
  requireActorRole(actor, "counselor");
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
