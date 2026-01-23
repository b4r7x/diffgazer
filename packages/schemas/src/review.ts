import { z } from "zod";
import {
  createDomainErrorCodes,
  createDomainErrorSchema,
  createStreamEventSchema,
  type SharedErrorCode,
} from "./errors.js";

/**
 * Schema for review scores (0-10 scale, nullable for cases where scoring is not applicable).
 * Used in ReviewResult.overallScore and FileReviewResult.score.
 */
export const ScoreSchema = z.number().min(0).max(10).nullable();

/**
 * A numeric score from 0-10 representing code review quality assessment.
 * - 0-3: Critical issues, needs significant work
 * - 4-6: Has issues but acceptable
 * - 7-10: Good to excellent quality
 * - null: Score not applicable or could not be determined
 *
 * Part of the public API for review results.
 */
export type Score = z.infer<typeof ScoreSchema>;

export const REVIEW_SEVERITY = ["critical", "warning", "suggestion", "nitpick"] as const;
export const ReviewSeveritySchema = z.enum(REVIEW_SEVERITY);
export type ReviewSeverity = z.infer<typeof ReviewSeveritySchema>;

export const REVIEW_CATEGORY = ["security", "performance", "style", "logic", "documentation", "best-practice"] as const;
export const ReviewCategorySchema = z.enum(REVIEW_CATEGORY);
export type ReviewCategory = z.infer<typeof ReviewCategorySchema>;

export const ReviewIssueSchema = z
  .object({
    severity: ReviewSeveritySchema,
    category: ReviewCategorySchema,
    file: z.string().nullable(),
    line: z.number().nullable(),
    title: z.string(),
    description: z.string(),
    suggestion: z.string().nullable(),
  })
  .refine((data) => !(data.line !== null && data.file === null), {
    message: "Line number requires a file to be specified",
    path: ["line"],
  });
export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;

export const ReviewResultSchema = z.object({
  summary: z.string(),
  issues: z.array(ReviewIssueSchema),
  overallScore: ScoreSchema,
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

/**
 * Schema for individual file review results used in chunked/batched review operations.
 *
 * Each file in a diff is reviewed separately, producing a FileReviewResult.
 * These are then aggregated into an overall ReviewResult via the review-aggregator service.
 *
 * The parseError fields track cases where AI output couldn't be parsed, allowing
 * the aggregator to distinguish between review failures and parse failures.
 */
export const FileReviewResultSchema = z.object({
  filePath: z.string(),
  summary: z.string(),
  issues: z.array(ReviewIssueSchema),
  score: ScoreSchema,
  /** When true, AI response couldn't be parsed - summary contains raw output */
  parseError: z.boolean().optional(),
  /** Error message describing why parsing failed */
  parseErrorMessage: z.string().optional(),
});

/**
 * Result of reviewing a single file in a chunked review operation.
 *
 * Used by:
 * - `review-orchestrator.ts`: Produces FileReviewResult for each file in a diff
 * - `review-aggregator.ts`: Combines multiple FileReviewResults into a final ReviewResult
 *
 * The parseError/parseErrorMessage fields allow graceful degradation when AI
 * responses cannot be parsed - the file is still tracked but excluded from
 * issue aggregation.
 */
export type FileReviewResult = z.infer<typeof FileReviewResultSchema>;

export const REVIEW_SPECIFIC_CODES = ["NO_DIFF", "AI_ERROR"] as const;
export type ReviewSpecificCode = (typeof REVIEW_SPECIFIC_CODES)[number];

export const REVIEW_ERROR_CODES = createDomainErrorCodes(REVIEW_SPECIFIC_CODES);
export const ReviewErrorCodeSchema = z.enum(REVIEW_ERROR_CODES as unknown as [string, ...string[]]);
export type ReviewErrorCode = SharedErrorCode | ReviewSpecificCode;

export const ReviewErrorSchema = createDomainErrorSchema(REVIEW_SPECIFIC_CODES);
export type ReviewError = z.infer<typeof ReviewErrorSchema>;

export const ReviewStreamEventSchema = createStreamEventSchema(
  { result: ReviewResultSchema },
  ReviewErrorSchema
);
export type ReviewStreamEvent = z.infer<typeof ReviewStreamEventSchema>;
