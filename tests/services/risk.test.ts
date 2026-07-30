import { describe, expect, it } from "vitest";
import {
  evaluateStudentRisk,
  evaluateSubjectRisk,
  type RiskThresholds,
} from "@/server/services/risk";

const thresholds: RiskThresholds = {
  attendanceWarningPercentage: 75,
  attendanceCriticalPercentage: 100,
  numericGradeDecline: 0,
  unresolvedInc: 1,
  drp: 1,
  crossSubject: 2,
};

const baseSubject = {
  enrollmentId: "enrollment-1",
  courseCode: "CS101",
  absenceCount: 0,
  allowableAbsences: 4,
  unresolvedInc: false,
  dropped: false,
};

describe("risk evaluation", () => {
  it("marks exactly 75 percent absence usage amber", () => {
    const result = evaluateSubjectRisk(
      { ...baseSubject, absenceCount: 3 },
      thresholds,
    );

    expect(result.severity).toBe("amber");
    expect(result.signals).toEqual([
      { code: "attendance_warning", severity: "amber" },
    ]);
  });

  it("marks 100 percent absence usage red", () => {
    const result = evaluateSubjectRisk(
      { ...baseSubject, absenceCount: 4 },
      thresholds,
    );

    expect(result.severity).toBe("red");
    expect(result.signals).toContainEqual({
      code: "attendance_critical",
      severity: "red",
    });
  });

  it("treats a larger midterm number as a declining PH grade", () => {
    const result = evaluateSubjectRisk(
      { ...baseSubject, prelimGrade: 1.75, midtermGrade: 2.5 },
      thresholds,
    );

    expect(result.signals).toContainEqual({
      code: "numeric_grade_decline",
      severity: "amber",
    });
  });

  it("treats DRP as red", () => {
    const result = evaluateSubjectRisk(
      { ...baseSubject, dropped: true },
      thresholds,
    );

    expect(result.severity).toBe("red");
  });

  it("adds cross-subject red status for two flagged subjects", () => {
    const result = evaluateStudentRisk(
      [
        { ...baseSubject, absenceCount: 3 },
        {
          ...baseSubject,
          enrollmentId: "enrollment-2",
          courseCode: "MATH101",
          dropped: true,
        },
      ],
      thresholds,
    );

    expect(result.crossSubjectTriggered).toBe(true);
    expect(result.severity).toBe("red");
  });
});
