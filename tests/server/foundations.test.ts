import { describe, expect, it } from "vitest";
import { AppError, serializeError } from "@/server/http/errors";
import {
  bulkAttendanceSubmissionSchema,
  gradeSubmissionSchema,
  sessionCreationSchema,
} from "@/server/validation/faculty";
import { supportSignalInputSchema } from "@/server/validation/student";

const sectionId = "00000000-0000-4000-8000-000000000001";
const enrollmentId = "00000000-0000-4000-8000-000000000002";

describe("backend foundations", () => {
  it("accepts an ISO session payload and rejects unknown keys", () => {
    const result = sessionCreationSchema.safeParse({
      sessionSequence: 1,
      startsAt: "2026-07-30T08:00:00Z",
      type: "lecture",
      unexpected: true,
    });

    expect(result.success).toBe(false);
  });

  it("rejects duplicate attendance entries at the request boundary", () => {
    const result = bulkAttendanceSubmissionSchema.safeParse({
      sessionId: sectionId,
      entries: [
        { enrollmentId, status: "present" },
        { enrollmentId, status: "absent" },
      ],
    });

    expect(result.success).toBe(false);
  });

  it("requires numeric values only for numeric grade marks", () => {
    const result = gradeSubmissionSchema.safeParse({
      gradePeriodId: sectionId,
      entries: [{ enrollmentId, markKind: "numeric" }],
    });

    expect(result.success).toBe(false);
  });

  it("allows an empty support signal payload but rejects client-controlled fields", () => {
    expect(supportSignalInputSchema.safeParse({}).success).toBe(true);
    expect(
      supportSignalInputSchema.safeParse({ studentId: sectionId }).success,
    ).toBe(false);
  });

  it("serializes unexpected errors without exposing internal details", () => {
    const serialized = serializeError(new Error("database password"));

    expect(serialized.status).toBe(500);
    expect(serialized.body).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
    });
  });
});
