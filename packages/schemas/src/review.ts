import { z } from "zod";

export const REVIEW_SEVERITY = ["critical", "warning", "suggestion", "nitpick"] as const;
export const ReviewSeveritySchema = z.enum(REVIEW_SEVERITY);
export type ReviewSeverity = z.infer<typeof ReviewSeveritySchema>;

export const REVIEW_CATEGORY = ["security", "performance", "style", "logic", "documentation", "best-practice"] as const;
export const ReviewCategorySchema = z.enum(REVIEW_CATEGORY);
export type ReviewCategory = z.infer<typeof ReviewCategorySchema>;

export const ReviewIssueSchema = z.object({
  severity: ReviewSeveritySchema,
  category: ReviewCategorySchema,
  file: z.string().nullable(),
  line: z.number().nullable(),
  title: z.string(),
  description: z.string(),
  suggestion: z.string().nullable(),
});
export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;

export const ReviewResultSchema = z.object({
  summary: z.string(),
  issues: z.array(ReviewIssueSchema),
  overallScore: z.number().min(0).max(10).optional(),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

export const REVIEW_ERROR_CODES = ["NO_DIFF", "AI_ERROR", "API_KEY_MISSING", "RATE_LIMITED", "INTERNAL_ERROR"] as const;
export const ReviewErrorCodeSchema = z.enum(REVIEW_ERROR_CODES);
export type ReviewErrorCode = z.infer<typeof ReviewErrorCodeSchema>;

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
