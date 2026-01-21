import { z } from "zod";
import { ReviewResultSchema } from "./review.js";

export const ReviewHistoryMetadataSchema = z.object({
  id: z.string().uuid(),
  projectPath: z.string(),
  createdAt: z.string().datetime(),
  staged: z.boolean(),
  branch: z.string().nullable(),
  overallScore: z.number().min(0).max(10).nullable(),
  issueCount: z.number().int().nonnegative(),
  criticalCount: z.number().int().nonnegative(),
  warningCount: z.number().int().nonnegative(),
});
export type ReviewHistoryMetadata = z.infer<typeof ReviewHistoryMetadataSchema>;

export const ReviewGitContextSchema = z.object({
  branch: z.string().nullable(),
  fileCount: z.number().int().nonnegative(),
});
export type ReviewGitContext = z.infer<typeof ReviewGitContextSchema>;

export const SavedReviewSchema = z.object({
  metadata: ReviewHistoryMetadataSchema,
  result: ReviewResultSchema,
  gitContext: ReviewGitContextSchema,
});
export type SavedReview = z.infer<typeof SavedReviewSchema>;
