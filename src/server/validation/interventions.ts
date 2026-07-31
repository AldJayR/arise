import { z } from "zod";

const uuid = z.uuid();

const contextualNote = z.string().trim().min(1).max(500);

export const referralInputSchema = z.strictObject({
  studentId: uuid,
  contextualNote: contextualNote.nullable().optional(),
});

export const interventionRouteParamsSchema = z.strictObject({
  caseId: uuid,
});

export const counselorCaseListQuerySchema = z.strictObject({
  status: z.enum(["pending", "contacted", "responded", "resolved"]).optional(),
});

export const caseStatusInputSchema = z.strictObject({
  status: z.enum(["pending", "contacted", "responded", "resolved"]),
});

export const interventionNoteInputSchema = z.strictObject({
  note: z.string().trim().min(1).max(2_000),
});

export type ReferralInput = z.infer<typeof referralInputSchema>;
export type CaseStatusInput = z.infer<typeof caseStatusInputSchema>;
export type InterventionNoteInput = z.infer<typeof interventionNoteInputSchema>;
