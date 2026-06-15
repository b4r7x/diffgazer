import { z } from "zod";
import { LensStatSchema } from "../events/agent.js";
import { createdAtField, UuidSchema } from "../fields.js";
import { ReviewResultSchema, ReviewSeveritySchema } from "./issues.js";
import { DrilldownResultSchema, LensIdSchema, ProfileIdSchema } from "./lens.js";

export const ReviewModeSchema = z.enum(["staged", "unstaged", "files"]);
export type ReviewMode = z.infer<typeof ReviewModeSchema>;

const CountFieldSchema = z.number().int().nonnegative();

const DiffStatsSchema = z.object({
  additions: CountFieldSchema,
  deletions: CountFieldSchema,
  sizeBytes: CountFieldSchema,
});

const DiffHunkSchema = z.object({
  oldStart: CountFieldSchema,
  oldCount: CountFieldSchema,
  newStart: CountFieldSchema,
  newCount: CountFieldSchema,
  content: z.string(),
});

const FileDiffSchema = z.object({
  filePath: z.string(),
  previousPath: z.string().nullable(),
  operation: z.enum(["add", "modify", "delete", "rename"]),
  hunks: z.array(DiffHunkSchema),
  rawDiff: z.string(),
  stats: DiffStatsSchema,
});

const ParsedDiffSchema = z.object({
  files: z.array(FileDiffSchema),
  totalStats: z.object({
    filesChanged: CountFieldSchema,
    additions: CountFieldSchema,
    deletions: CountFieldSchema,
    totalSizeBytes: CountFieldSchema,
  }),
});

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
    mode: data.mode ?? (data.staged ? "staged" : "unstaged"),
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
  diff: ParsedDiffSchema.optional(),
  gitContext: ReviewGitContextSchema,
  drilldowns: z.array(DrilldownResultSchema),
  lensStats: z.array(LensStatSchema).optional(),
  // Count of issues removed after streaming (silently dropped from the final
  // result) so the summary can surface "K below-threshold issue(s) hidden".
  droppedBelowThreshold: CountFieldSchema.optional(),
  droppedDuplicates: CountFieldSchema.optional(),
  // The severity floor those issues fell below, so the notice can name the
  // threshold the user can lower to surface them.
  minSeverity: ReviewSeveritySchema.optional(),
});
export type SavedReview = z.infer<typeof SavedReviewSchema>;

export const CreateReviewResponseSchema = z.object({
  reviewId: UuidSchema,
});
export type CreateReviewResponse = z.infer<typeof CreateReviewResponseSchema>;

export const ReviewsResponseSchema = z.object({
  reviews: z.array(ReviewMetadataSchema),
  warnings: z.array(z.string()).optional(),
});
export type ReviewsResponse = z.infer<typeof ReviewsResponseSchema>;

export const ReviewResponseSchema = z.object({
  review: SavedReviewSchema,
});
export type ReviewResponse = z.infer<typeof ReviewResponseSchema>;

export const ActiveReviewSessionSchema = z.object({
  reviewId: UuidSchema,
  mode: ReviewModeSchema,
  startedAt: z.string(),
  headCommit: z.string(),
  statusHash: z.string(),
});
export type ActiveReviewSession = z.infer<typeof ActiveReviewSessionSchema>;

export const ActiveReviewSessionResponseSchema = z.object({
  session: ActiveReviewSessionSchema.nullable(),
});
export type ActiveReviewSessionResponse = z.infer<typeof ActiveReviewSessionResponseSchema>;
