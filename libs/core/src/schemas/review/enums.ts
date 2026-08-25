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

/**
 * The lenses a user can pick for a review. `synthesis` is deliberately absent:
 * it is dispatched only by the engine, when a review had to run in more than one
 * batch, so it must never appear in a profile, a settings default, or a picker.
 */
export const SELECTABLE_LENS_IDS = [
  "correctness",
  "security",
  "performance",
  "simplicity",
  "tests",
] as const;

export const SelectableLensIdSchema = z.enum(SELECTABLE_LENS_IDS);
export type SelectableLensId = z.infer<typeof SelectableLensIdSchema>;

export const LENS_IDS = [...SELECTABLE_LENS_IDS, "synthesis"] as const;

export const LensIdSchema = z.enum(LENS_IDS);
export type LensId = z.infer<typeof LensIdSchema>;

const PROFILE_IDS = ["quick", "strict", "perf", "security"] as const;
export const ProfileIdSchema = z.enum(PROFILE_IDS);
export type ProfileId = z.infer<typeof ProfileIdSchema>;

export interface ReviewProfile {
  id: ProfileId;
  name: string;
  description: string;
  lenses: SelectableLensId[];
  filter?: SeverityFilter;
}
