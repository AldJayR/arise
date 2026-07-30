import { and, desc, eq, gt, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { RlsTransaction } from "@/db/client";
import {
  attendancePolicies,
  attendanceRecords,
  classSessions,
  courses,
  enrollments,
  gradePeriods,
  gradeRecords,
  riskEvaluations,
  riskRuleDefinitions,
  riskRuleVersions,
  riskSignalEnrollments,
  riskSignals,
  sections,
} from "@/db/schema";
import { conflict } from "@/server/http/errors";

export type RiskRuleCode =
  | "attendance_warning"
  | "attendance_critical"
  | "numeric_grade_decline"
  | "unresolved_inc"
  | "drp"
  | "cross_subject";

export type RiskSeverity = "green" | "amber" | "red";

export type RiskThresholds = {
  attendanceWarningPercentage: number;
  attendanceCriticalPercentage: number;
  numericGradeDecline: number;
  unresolvedInc: number;
  drp: number;
  crossSubject: number;
};

export type SubjectRiskInput = {
  enrollmentId: string;
  courseCode: string;
  absenceCount: number;
  allowableAbsences: number;
  prelimGrade?: number;
  midtermGrade?: number;
  unresolvedInc: boolean;
  dropped: boolean;
};

export type SubjectRiskSignal = {
  code: Exclude<RiskRuleCode, "cross_subject">;
  severity: Exclude<RiskSeverity, "green">;
};

export type SubjectRiskResult = {
  enrollmentId: string;
  courseCode: string;
  severity: RiskSeverity;
  absencePercentage: number;
  signals: SubjectRiskSignal[];
};

export type StudentRiskResult = {
  severity: RiskSeverity;
  subjects: SubjectRiskResult[];
  crossSubjectTriggered: boolean;
};

function maxSeverity(
  current: RiskSeverity,
  next: Exclude<RiskSeverity, "green">,
): RiskSeverity {
  if (current === "red" || next === "red") {
    return "red";
  }
  return "amber";
}

function absencePercentage(absenceCount: number, allowableAbsences: number) {
  if (allowableAbsences === 0) {
    return absenceCount > 0 ? 100 : 0;
  }
  return (absenceCount / allowableAbsences) * 100;
}

export function evaluateSubjectRisk(
  input: SubjectRiskInput,
  thresholds: RiskThresholds,
): SubjectRiskResult {
  const percentage = absencePercentage(
    input.absenceCount,
    input.allowableAbsences,
  );
  const signals: SubjectRiskSignal[] = [];
  let severity: RiskSeverity = "green";

  if (percentage >= thresholds.attendanceCriticalPercentage) {
    signals.push({ code: "attendance_critical", severity: "red" });
    severity = "red";
  } else if (percentage >= thresholds.attendanceWarningPercentage) {
    signals.push({ code: "attendance_warning", severity: "amber" });
    severity = "amber";
  }

  if (
    input.prelimGrade !== undefined &&
    input.midtermGrade !== undefined &&
    input.midtermGrade - input.prelimGrade > thresholds.numericGradeDecline
  ) {
    signals.push({ code: "numeric_grade_decline", severity: "amber" });
    severity = maxSeverity(severity, "amber");
  }

  if (input.unresolvedInc) {
    signals.push({ code: "unresolved_inc", severity: "amber" });
    severity = maxSeverity(severity, "amber");
  }

  if (input.dropped) {
    signals.push({ code: "drp", severity: "red" });
    severity = "red";
  }

  return {
    enrollmentId: input.enrollmentId,
    courseCode: input.courseCode,
    severity,
    absencePercentage: percentage,
    signals,
  };
}

export function evaluateStudentRisk(
  subjects: SubjectRiskInput[],
  thresholds: RiskThresholds,
): StudentRiskResult {
  const subjectResults = subjects.map((subject) =>
    evaluateSubjectRisk(subject, thresholds),
  );
  const flaggedSubjects = subjectResults.filter(
    (subject) => subject.severity !== "green",
  );
  const crossSubjectTriggered =
    flaggedSubjects.length >= thresholds.crossSubject;

  return {
    severity:
      flaggedSubjects.some((subject) => subject.severity === "red") ||
      crossSubjectTriggered
        ? "red"
        : flaggedSubjects.length > 0
          ? "amber"
          : "green",
    subjects: subjectResults,
    crossSubjectTriggered,
  };
}

type ActiveRule = {
  id: string;
  code: RiskRuleCode;
  thresholdValue: number;
  version: number;
};

async function loadActiveRules(
  transaction: RlsTransaction,
): Promise<ActiveRule[]> {
  const now = new Date();
  const rows = await transaction
    .select({
      id: riskRuleVersions.id,
      code: riskRuleDefinitions.code,
      thresholdValue: riskRuleVersions.thresholdValue,
      version: riskRuleVersions.version,
    })
    .from(riskRuleVersions)
    .innerJoin(
      riskRuleDefinitions,
      eq(riskRuleDefinitions.id, riskRuleVersions.ruleDefinitionId),
    )
    .where(
      and(
        lte(riskRuleVersions.activeFrom, now),
        or(
          isNull(riskRuleVersions.activeUntil),
          gt(riskRuleVersions.activeUntil, now),
        ),
      ),
    );

  const latestByCode = new Map<RiskRuleCode, ActiveRule>();
  for (const row of rows) {
    const current = latestByCode.get(row.code);
    if (!current || row.version > current.version) {
      latestByCode.set(row.code, {
        id: row.id,
        code: row.code,
        thresholdValue: row.thresholdValue,
        version: row.version,
      });
    }
  }

  if (latestByCode.size !== 6) {
    throw conflict("Active risk rules are not configured");
  }

  return [...latestByCode.values()];
}

function thresholdsFromRules(rules: ActiveRule[]): RiskThresholds {
  const value = (code: RiskRuleCode) =>
    rules.find((rule) => rule.code === code)?.thresholdValue ?? 0;
  return {
    attendanceWarningPercentage: value("attendance_warning"),
    attendanceCriticalPercentage: value("attendance_critical"),
    numericGradeDecline: value("numeric_grade_decline"),
    unresolvedInc: value("unresolved_inc"),
    drp: value("drp"),
    crossSubject: value("cross_subject"),
  };
}

export async function evaluateAndPersistStudentRisk(
  transaction: RlsTransaction,
  studentId: string,
) {
  const rules = await loadActiveRules(transaction);
  const thresholds = thresholdsFromRules(rules);
  const subjectRows = await transaction
    .select({
      enrollmentId: enrollments.id,
      courseCode: courses.code,
      allowableAbsences: attendancePolicies.allowableAbsences,
      absenceCount: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'absent')::int`,
    })
    .from(enrollments)
    .innerJoin(sections, eq(sections.id, enrollments.sectionId))
    .innerJoin(courses, eq(courses.id, sections.courseId))
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
      ),
    )
    .groupBy(
      enrollments.id,
      courses.code,
      attendancePolicies.allowableAbsences,
    );

  const gradeRows = await transaction
    .select({
      enrollmentId: gradeRecords.enrollmentId,
      period: gradePeriods.code,
      markKind: gradeRecords.markKind,
      numericValue: gradeRecords.numericValue,
    })
    .from(gradeRecords)
    .innerJoin(gradePeriods, eq(gradePeriods.id, gradeRecords.gradePeriodId))
    .innerJoin(enrollments, eq(enrollments.id, gradeRecords.enrollmentId))
    .where(eq(enrollments.studentId, studentId));

  const gradesByEnrollment = new Map<
    string,
    {
      prelim?: number;
      midterm?: number;
      unresolvedInc: boolean;
      dropped: boolean;
    }
  >();
  for (const grade of gradeRows) {
    const current = gradesByEnrollment.get(grade.enrollmentId) ?? {
      unresolvedInc: false,
      dropped: false,
    };
    if (grade.period === "prelim" && grade.markKind === "numeric") {
      current.prelim = grade.numericValue ?? undefined;
    }
    if (grade.period === "midterm" && grade.markKind === "numeric") {
      current.midterm = grade.numericValue ?? undefined;
    }
    if (grade.markKind === "inc") {
      current.unresolvedInc = true;
    }
    if (grade.markKind === "drp") {
      current.dropped = true;
    }
    gradesByEnrollment.set(grade.enrollmentId, current);
  }

  const evaluation = evaluateStudentRisk(
    subjectRows.map((subject) => ({
      enrollmentId: subject.enrollmentId,
      courseCode: subject.courseCode,
      absenceCount: subject.absenceCount,
      allowableAbsences: subject.allowableAbsences,
      ...gradesByEnrollment.get(subject.enrollmentId),
      unresolvedInc:
        gradesByEnrollment.get(subject.enrollmentId)?.unresolvedInc ?? false,
      dropped: gradesByEnrollment.get(subject.enrollmentId)?.dropped ?? false,
    })),
    thresholds,
  );

  const [evaluationRow] = await transaction
    .insert(riskEvaluations)
    .values({ studentId, engineVersion: "rule-based-v1" })
    .returning({ id: riskEvaluations.id });

  const ruleIds = new Map(rules.map((rule) => [rule.code, rule.id]));
  type PersistedSignal = {
    code: RiskRuleCode;
    severity: Exclude<RiskSeverity, "green">;
    enrollmentIds: string[];
  };
  const triggeredSignals: PersistedSignal[] = evaluation.subjects.flatMap(
    (subject) =>
      subject.signals.map((signal) => ({
        ...signal,
        enrollmentIds: [subject.enrollmentId],
      })),
  );

  if (evaluation.crossSubjectTriggered) {
    triggeredSignals.push({
      code: "cross_subject",
      severity: "red",
      enrollmentIds: evaluation.subjects
        .filter((subject) => subject.severity !== "green")
        .map((subject) => subject.enrollmentId),
    });
  }

  for (const signal of triggeredSignals) {
    const ruleVersionId = ruleIds.get(signal.code);
    if (!ruleVersionId) {
      continue;
    }
    const [signalRow] = await transaction
      .insert(riskSignals)
      .values({
        evaluationId: evaluationRow.id,
        ruleVersionId,
        severity: signal.severity,
      })
      .returning({ id: riskSignals.id });

    if (signal.enrollmentIds.length > 0) {
      await transaction.insert(riskSignalEnrollments).values(
        signal.enrollmentIds.map((enrollmentId) => ({
          riskSignalId: signalRow.id,
          enrollmentId,
        })),
      );
    }
  }

  return evaluation;
}

export async function getCurrentRiskSummaries(
  transaction: RlsTransaction,
  studentIds: string[],
) {
  const summaries = new Map<
    string,
    { severity: RiskSeverity; signalCount: number }
  >();
  if (studentIds.length === 0) {
    return summaries;
  }

  const evaluations = await transaction
    .select({
      id: riskEvaluations.id,
      studentId: riskEvaluations.studentId,
    })
    .from(riskEvaluations)
    .where(inArray(riskEvaluations.studentId, studentIds))
    .orderBy(desc(riskEvaluations.evaluatedAt));
  const latestEvaluationByStudent = new Map<string, string>();
  for (const evaluation of evaluations) {
    if (!latestEvaluationByStudent.has(evaluation.studentId)) {
      latestEvaluationByStudent.set(evaluation.studentId, evaluation.id);
    }
  }

  const evaluationIds = [...latestEvaluationByStudent.values()];
  const signals = evaluationIds.length
    ? await transaction
        .select({
          evaluationId: riskSignals.evaluationId,
          severity: riskSignals.severity,
        })
        .from(riskSignals)
        .where(inArray(riskSignals.evaluationId, evaluationIds))
    : [];
  const signalSummary = new Map<
    string,
    { severity: RiskSeverity; count: number }
  >();
  for (const signal of signals) {
    const current = signalSummary.get(signal.evaluationId) ?? {
      severity: "green" as const,
      count: 0,
    };
    signalSummary.set(signal.evaluationId, {
      severity:
        current.severity === "red" || signal.severity === "red"
          ? "red"
          : "amber",
      count: current.count + 1,
    });
  }

  for (const studentId of studentIds) {
    const evaluationId = latestEvaluationByStudent.get(studentId);
    const summary = evaluationId ? signalSummary.get(evaluationId) : undefined;
    summaries.set(studentId, {
      severity: summary?.severity ?? "green",
      signalCount: summary?.count ?? 0,
    });
  }
  return summaries;
}
