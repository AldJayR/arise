import { z } from "zod";

export const supportSignalInputSchema = z.strictObject({});

export type SupportSignalInput = z.infer<typeof supportSignalInputSchema>;
