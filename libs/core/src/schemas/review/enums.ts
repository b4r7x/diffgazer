import { z } from "zod";

export const REVIEW_SEVERITY = ["blocker", "high", "medium", "low", "nit"] as const;
export const ReviewSeveritySchema = z.enum(REVIEW_SEVERITY);
export type ReviewSeverity = z.infer<typeof ReviewSeveritySchema>;

export const SAVED_REVIEW_EXECUTION_SCHEMA_VERSION = 1;
export const SavedReviewExecutionSchemaVersionSchema = z.literal(
  SAVED_REVIEW_EXECUTION_SCHEMA_VERSION,
);

export interface SeverityFilter {
  minSeverity: ReviewSeverity;
}

export const LENS_IDS = ["correctness", "security", "performance", "simplicity", "tests"] as const;

export const LensIdSchema = z.enum(LENS_IDS);
export type LensId = z.infer<typeof LensIdSchema>;

const PROFILE_IDS = ["quick", "strict", "perf", "security"] as const;
export const ProfileIdSchema = z.enum(PROFILE_IDS);
export type ProfileId = z.infer<typeof ProfileIdSchema>;

export interface ReviewProfile {
  id: ProfileId;
  name: string;
  description: string;
  lenses: LensId[];
  filter?: SeverityFilter;
}
