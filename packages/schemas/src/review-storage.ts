import { z } from "zod";
import { UuidSchema, createdAtField } from "./errors.js";
import { ReviewResultSchema } from "./review.js";
import { LensIdSchema, ProfileIdSchema, DrilldownResultSchema } from "./lens.js";

export const ReviewModeSchema = z.enum(["staged", "unstaged", "files"]);
export type ReviewMode = z.infer<typeof ReviewModeSchema>;

const countField = z.number().int().nonnegative();

export const ReviewMetadataSchema = z
  .object({
    id: UuidSchema,
    projectPath: z.string(),
    ...createdAtField,
    mode: ReviewModeSchema.optional(),
    staged: z.boolean().optional(), // Deprecated: kept for backward compat
    branch: z.string().nullable(),
    profile: ProfileIdSchema.nullable(),
    lenses: z.array(LensIdSchema),
    issueCount: countField,
    // For backward compatibility: accept missing count fields, default to 0
    blockerCount: countField.optional(),
    highCount: countField.optional(),
    mediumCount: countField.optional(),
    lowCount: countField.optional(),
    nitCount: countField.optional(),
    fileCount: countField,
    durationMs: countField.optional(),
  })
  .transform((data) => ({
    ...data,
    // Migrate old staged boolean to mode
    mode: data.mode ?? (data.staged ? "staged" : "unstaged"),
    blockerCount: data.blockerCount ?? 0,
    highCount: data.highCount ?? 0,
    mediumCount: data.mediumCount ?? 0,
    lowCount: data.lowCount ?? 0,
    nitCount: data.nitCount ?? 0,
  }));
export type ReviewMetadata = z.infer<typeof ReviewMetadataSchema>;

export const ReviewGitContextSchema = z.object({
  branch: z.string().nullable(),
  commit: z.string().nullable(),
  fileCount: countField,
  additions: countField,
  deletions: countField,
});
export type ReviewGitContext = z.infer<typeof ReviewGitContextSchema>;

export const SavedReviewSchema = z.object({
  metadata: ReviewMetadataSchema,
  result: ReviewResultSchema,
  gitContext: ReviewGitContextSchema,
  drilldowns: z.array(DrilldownResultSchema),
});
export type SavedReview = z.infer<typeof SavedReviewSchema>;
