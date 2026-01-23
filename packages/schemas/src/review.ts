import { z } from "zod";
import { SHARED_ERROR_CODES, type SharedErrorCode } from "./errors.js";

/** Score schema for review scores (0-10 scale, nullable) */
export const ScoreSchema = z.number().min(0).max(10).nullable();
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

export const FileReviewResultSchema = z.object({
  filePath: z.string(),
  summary: z.string(),
  issues: z.array(ReviewIssueSchema),
  score: ScoreSchema,
  /**
   * Indicates the AI response could not be parsed as valid JSON.
   * When true, summary contains raw AI output and issues array is empty.
   * UI should warn users that review results may be incomplete.
   */
  parseError: z.boolean().optional(),
  /**
   * When parseError is true, contains the original parse error message
   * for debugging purposes.
   */
  parseErrorMessage: z.string().optional(),
});
export type FileReviewResult = z.infer<typeof FileReviewResultSchema>;

/** Review-specific error codes (domain-specific) */
export const REVIEW_SPECIFIC_CODES = ["NO_DIFF", "AI_ERROR"] as const;
export type ReviewSpecificCode = (typeof REVIEW_SPECIFIC_CODES)[number];

/** All review error codes: shared + domain-specific */
export const REVIEW_ERROR_CODES = [...SHARED_ERROR_CODES, ...REVIEW_SPECIFIC_CODES] as const;
export const ReviewErrorCodeSchema = z.enum(REVIEW_ERROR_CODES);
export type ReviewErrorCode = SharedErrorCode | ReviewSpecificCode;

export const ReviewErrorSchema = z.object({
  message: z.string(),
  code: ReviewErrorCodeSchema,
});
export type ReviewError = z.infer<typeof ReviewErrorSchema>;

export const ReviewStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chunk"), content: z.string() }),
  z.object({ type: z.literal("complete"), result: ReviewResultSchema }),
  z.object({ type: z.literal("error"), error: ReviewErrorSchema }),
]);
export type ReviewStreamEvent = z.infer<typeof ReviewStreamEventSchema>;
