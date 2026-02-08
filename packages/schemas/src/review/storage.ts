import { z } from "zod";
import { UuidSchema, createdAtField } from "../errors.js";
import { ReviewResultSchema } from "./issues.js";
import { LensIdSchema, ProfileIdSchema, DrilldownResultSchema } from "./lens.js";

export const ReviewModeSchema = z.enum(["staged", "unstaged", "files"]);
export type ReviewMode = z.infer<typeof ReviewModeSchema>;

const CountFieldSchema = z.number().int().nonnegative();

export const ReviewMetadataSchema = z
  .object({
    id: UuidSchema,
    projectPath: z.string(),
    ...createdAtField,
    mode: ReviewModeSchema.optional(),
    staged: z.boolean().optional(),
    branch: z.string().nullable(),
    profile: ProfileIdSchema.nullable(),
    lenses: z.array(LensIdSchema),
    issueCount: CountFieldSchema,
    blockerCount: CountFieldSchema.default(0),
    highCount: CountFieldSchema.default(0),
    mediumCount: CountFieldSchema.default(0),
    lowCount: CountFieldSchema.default(0),
    nitCount: CountFieldSchema.default(0),
    fileCount: CountFieldSchema,
    durationMs: CountFieldSchema.optional(),
  })
  .transform((data) => ({
    ...data,
    mode: data.mode ?? (data.staged ? "staged" : "unstaged") as ReviewMode,
  }));
export type ReviewMetadata = z.infer<typeof ReviewMetadataSchema>;

export const ReviewGitContextSchema = z.object({
  branch: z.string().nullable(),
  commit: z.string().nullable(),
  fileCount: CountFieldSchema,
  additions: CountFieldSchema,
  deletions: CountFieldSchema,
});
export type ReviewGitContext = z.infer<typeof ReviewGitContextSchema>;

export const SavedReviewSchema = z.object({
  metadata: ReviewMetadataSchema,
  result: ReviewResultSchema,
  gitContext: ReviewGitContextSchema,
  drilldowns: z.array(DrilldownResultSchema),
});
export type SavedReview = z.infer<typeof SavedReviewSchema>;
