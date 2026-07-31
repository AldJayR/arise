import { z } from "zod";

export const privacyConsentInputSchema = z.object({}).strict();

export type PrivacyConsentInput = z.infer<typeof privacyConsentInputSchema>;
