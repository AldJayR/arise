import { z } from "zod";

const uuid = z.uuid();
const isoDateTime = z.iso.datetime({ offset: true });

export const sectionRouteParamsSchema = z.strictObject({
  sectionId: uuid,
});

export const sessionCreationSchema = z.strictObject({
  sessionSequence: z.number().int().positive().max(10_000),
  startsAt: isoDateTime,
  endsAt: isoDateTime.optional(),
  type: z.enum(["lecture", "lab"]),
});

const attendanceEntrySchema = z.strictObject({
  enrollmentId: uuid,
  status: z.enum(["present", "absent", "late", "excused"]),
});

export const bulkAttendanceSubmissionSchema = z
  .strictObject({
    sessionId: uuid,
    entries: z.array(attendanceEntrySchema).min(1).max(500),
  })
  .refine(
    (payload) =>
      new Set(payload.entries.map((entry) => entry.enrollmentId)).size ===
      payload.entries.length,
    {
      path: ["entries"],
      message: "Attendance entries must not contain duplicate enrollment IDs",
    },
  );

const numericGradeEntrySchema = z.strictObject({
  enrollmentId: uuid,
  markKind: z.literal("numeric"),
  numericValue: z.number().min(1).max(5),
});

const specialGradeEntrySchema = z.discriminatedUnion("markKind", [
  z.strictObject({ enrollmentId: uuid, markKind: z.literal("inc") }),
  z.strictObject({ enrollmentId: uuid, markKind: z.literal("drp") }),
  z.strictObject({ enrollmentId: uuid, markKind: z.literal("pass") }),
  z.strictObject({ enrollmentId: uuid, markKind: z.literal("fail") }),
]);

export const gradeEntrySchema = z.discriminatedUnion("markKind", [
  numericGradeEntrySchema,
  ...specialGradeEntrySchema.options,
]);

export const gradeSubmissionSchema = z
  .strictObject({
    gradePeriodId: uuid,
    entries: z.array(gradeEntrySchema).min(1).max(500),
  })
  .refine(
    (payload) =>
      new Set(payload.entries.map((entry) => entry.enrollmentId)).size ===
      payload.entries.length,
    {
      path: ["entries"],
      message: "Grade entries must not contain duplicate enrollment IDs",
    },
  );

export type SessionCreationInput = z.infer<typeof sessionCreationSchema>;
export type BulkAttendanceSubmission = z.infer<
  typeof bulkAttendanceSubmissionSchema
>;
export type GradeSubmission = z.infer<typeof gradeSubmissionSchema>;
