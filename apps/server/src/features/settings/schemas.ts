import { z } from "zod";
import { LensIdSchema, ProfileIdSchema } from "@stargazer/schemas/lens";
import { ReviewSeveritySchema } from "@stargazer/schemas/review";

export const settingsSchema = z.object({
  theme: z.enum(["auto", "dark", "light", "terminal"]).optional(),
  defaultLenses: z.array(LensIdSchema).optional(),
  defaultProfile: ProfileIdSchema.nullable().optional(),
  severityThreshold: ReviewSeveritySchema.optional(),
  secretsStorage: z.enum(["file", "keyring"]).nullable().optional(),
});

export const projectIdQuery = z.object({
  projectId: z.string().min(1),
});
