import { z } from "zod";

export const REVIEW_SEVERITY = ["blocker", "high", "medium", "low", "nit"] as const;
export const ReviewSeveritySchema = z.enum(REVIEW_SEVERITY);
export type ReviewSeverity = z.infer<typeof ReviewSeveritySchema>;

export const SeverityFilterSchema = z.object({
  minSeverity: ReviewSeveritySchema,
});
export type SeverityFilter = z.infer<typeof SeverityFilterSchema>;

export const LENS_IDS = [
  "correctness",
  "security",
  "performance",
  "simplicity",
  "tests",
] as const;

export const LensIdSchema = z.enum(LENS_IDS);
export type LensId = z.infer<typeof LensIdSchema>;

export const PROFILE_IDS = ["quick", "strict", "perf", "security"] as const;
export const ProfileIdSchema = z.enum(PROFILE_IDS);
export type ProfileId = z.infer<typeof ProfileIdSchema>;

export const ReviewProfileSchema = z.object({
  id: ProfileIdSchema,
  name: z.string(),
  description: z.string(),
  lenses: z.array(LensIdSchema),
  filter: SeverityFilterSchema.optional(),
});
export type ReviewProfile = z.infer<typeof ReviewProfileSchema>;
