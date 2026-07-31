import { describe, expect, it } from "vitest";
import {
  caseStatusInputSchema,
  counselorCaseListQuerySchema,
  interventionNoteInputSchema,
  referralInputSchema,
} from "@/server/validation/interventions";

const studentId = "00000000-0000-4000-8000-000000000001";

describe("intervention request boundaries", () => {
  it("accepts only a target student and optional trimmed referral context", () => {
    const result = referralInputSchema.safeParse({
      studentId,
      contextualNote: "  Attendance concerns  ",
    });

    expect(result.success).toBe(true);
    expect(result.success && result.data).toEqual({
      studentId,
      contextualNote: "Attendance concerns",
    });
    expect(
      referralInputSchema.safeParse({
        studentId,
        counselorEmployeeId: studentId,
      }).success,
    ).toBe(false);
  });

  it("rejects blank or oversized referral context", () => {
    expect(
      referralInputSchema.safeParse({ studentId, contextualNote: "   " })
        .success,
    ).toBe(false);
    expect(
      referralInputSchema.safeParse({
        studentId,
        contextualNote: "x".repeat(501),
      }).success,
    ).toBe(false);
  });

  it("accepts only the supported case statuses and one optional list filter", () => {
    expect(
      caseStatusInputSchema.safeParse({ status: "responded" }).success,
    ).toBe(true);
    expect(caseStatusInputSchema.safeParse({ status: "closed" }).success).toBe(
      false,
    );
    expect(
      counselorCaseListQuerySchema.safeParse({ status: "resolved" }).success,
    ).toBe(true);
    expect(
      counselorCaseListQuerySchema.safeParse({
        status: "resolved",
        search: "a",
      }).success,
    ).toBe(false);
  });

  it("rejects blank intervention notes and client-controlled authors", () => {
    expect(interventionNoteInputSchema.safeParse({ note: "  " }).success).toBe(
      false,
    );
    expect(
      interventionNoteInputSchema.safeParse({
        note: "  Followed up  ",
        authorEmployeeId: studentId,
      }).success,
    ).toBe(false);
    expect(
      interventionNoteInputSchema.safeParse({ note: "  Followed up  " }).data,
    ).toEqual({ note: "Followed up" });
  });
});
