import { z } from "zod";
import { UuidSchema, createdAtField } from "./errors.js";
import { ReviewResultSchema, ScoreSchema } from "./review.js";

export const ReviewHistoryMetadataSchema = z.object({
  id: UuidSchema,
  projectPath: z.string(),
  ...createdAtField,
  staged: z.boolean(),
  branch: z.string().nullable(),
  overallScore: ScoreSchema,
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

export const SavedReviewSchema = z
  .object({
    metadata: ReviewHistoryMetadataSchema,
    result: ReviewResultSchema,
    gitContext: ReviewGitContextSchema,
  })
  .refine(
    (data) => {
      const issues = data.result.issues;
      const criticalCount = issues.filter((i) => i.severity === "critical").length;
      const warningCount = issues.filter((i) => i.severity === "warning").length;

      return (
        data.metadata.issueCount === issues.length &&
        data.metadata.criticalCount === criticalCount &&
        data.metadata.warningCount === warningCount
      );
    },
    {
      message: "Metadata counts must match actual issue data",
    }
  );
export type SavedReview = z.infer<typeof SavedReviewSchema>;
