import { z } from "zod";
import {
  createDomainErrorCodes,
  createDomainErrorSchema,
  createStreamEventSchema,
  type SharedErrorCode,
} from "./errors.js";

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
  parseError: z.boolean().optional(),
  parseErrorMessage: z.string().optional(),
});

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
