import { z } from "zod";
import { createDomainErrorSchema } from "../errors.js";
import {
  type LensId,
  type ReviewProfile,
  ReviewSeveritySchema,
  type SeverityFilter,
} from "./enums.js";

export { REVIEW_SEVERITY, type ReviewSeverity, ReviewSeveritySchema } from "./enums.js";

export const REVIEW_CATEGORY = [
  "correctness",
  "security",
  "performance",
  "api",
  "tests",
  "readability",
  "style",
] as const;
export const ReviewCategorySchema = z.enum(REVIEW_CATEGORY);
export type ReviewCategory = z.infer<typeof ReviewCategorySchema>;

const EVIDENCE_TYPE = ["code", "doc", "trace", "external"] as const;
const EvidenceTypeSchema = z.enum(EVIDENCE_TYPE);

const EvidenceRefSchema = z.object({
  type: EvidenceTypeSchema,
  title: z.string(),
  sourceId: z.string(),
  file: z.string().optional(),
  // Evidence ranges mirror the line-field tolerance above: 0.1.3-era reviews
  // stored these as plain numbers and providers emit zero/negative/inverted
  // values, so the positivity/ordering refines that voided whole records are
  // deliberately absent. The write path emits valid ranges from diff extraction.
  range: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  excerpt: z.string(),
  sha: z.string().optional(),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const TraceRefSchema = z.object({
  step: z.number(),
  tool: z.string(),
  inputSummary: z.string(),
  outputSummary: z.string(),
  timestamp: z.string(),
  artifacts: z.array(z.string()).optional(),
});
export type TraceRef = z.infer<typeof TraceRefSchema>;

const FixPlanStepSchema = z.object({
  step: z.number(),
  action: z.string(),
  files: z.array(z.string()).optional(),
  risk: z.enum(["low", "medium", "high"]).optional(),
});
export type FixPlanStep = z.infer<typeof FixPlanStepSchema>;

// Line numbers are provider-supplied and unenforceable at the JSON-schema layer:
// no responseSchema translation expresses cross-field ordering, and models
// routinely emit zero/float/inverted line numbers. They are read leniently here
// (plain nullable numbers, no positivity/ordering refines) and corrected by
// `normalizeIssueLineFields` on the write path; the refines that previously voided
// whole paid reviews are deliberately absent.
export const ReviewIssueSchema = z.object({
  id: z.string(),
  severity: ReviewSeveritySchema,
  category: ReviewCategorySchema,
  title: z.string(),
  file: z.string(),
  line_start: z.number().nullable(),
  line_end: z.number().nullable(),
  rationale: z.string(),
  recommendation: z.string(),
  suggested_patch: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  symptom: z.string(),
  whyItMatters: z.string(),
  fixPlan: z.array(FixPlanStepSchema).optional(),
  betterOptions: z.array(z.string()).optional(),
  testsToAdd: z.array(z.string()).optional(),
  evidence: z.array(EvidenceRefSchema),
  trace: z.array(TraceRefSchema).optional(),
});
export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;

export const ReviewResultSchema = z.object({
  summary: z.string(),
  issues: z.array(ReviewIssueSchema),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

export const ReviewErrorCode = {
  NO_DIFF: "NO_DIFF",
  AI_ERROR: "AI_ERROR",
  GENERATION_FAILED: "GENERATION_FAILED",
  GIT_NOT_FOUND: "GIT_NOT_FOUND",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  CANCELLED: "CANCELLED",
  SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
  SESSION_STALE: "SESSION_STALE",
  SESSION_EVICTED: "SESSION_EVICTED",
  SESSION_TIMEOUT: "SESSION_TIMEOUT",
  SERVER_SHUTDOWN: "SERVER_SHUTDOWN",
} as const;

export type ReviewErrorCode = (typeof ReviewErrorCode)[keyof typeof ReviewErrorCode];

const REVIEW_SPECIFIC_CODES = [
  ReviewErrorCode.NO_DIFF,
  ReviewErrorCode.AI_ERROR,
  ReviewErrorCode.GENERATION_FAILED,
  ReviewErrorCode.GIT_NOT_FOUND,
  ReviewErrorCode.INTERNAL_ERROR,
  ReviewErrorCode.CANCELLED,
  ReviewErrorCode.SESSION_NOT_FOUND,
  ReviewErrorCode.SESSION_STALE,
  ReviewErrorCode.SESSION_EVICTED,
  ReviewErrorCode.SESSION_TIMEOUT,
  ReviewErrorCode.SERVER_SHUTDOWN,
] as const;

export const ReviewErrorSchema = createDomainErrorSchema(REVIEW_SPECIFIC_CODES);
/** @see diffgazer/apps/server/src/shared/lib/review/types.ts ReviewError (lightweight server-internal variant) */
export type ReviewError = z.infer<typeof ReviewErrorSchema>;

export const ReviewStreamEventSchema = z.discriminatedUnion("type", [
  // `chunk` carries the server's event-cap warning to the client; it is the only
  // free-text member with a no-op effect on UI step/agent state.
  z.object({ type: z.literal("chunk"), content: z.string() }),
  z.object({
    type: z.literal("complete"),
    result: ReviewResultSchema,
    reviewId: z.string(),
    durationMs: z.number().optional(),
  }),
  z.object({ type: z.literal("error"), error: ReviewErrorSchema }),
]);
export type ReviewStreamEvent = z.infer<typeof ReviewStreamEventSchema>;

export { type SeverityFilter, SeverityFilterSchema } from "./enums.js";

export interface ReviewOptions {
  profile?: ReviewProfile;
  lenses?: LensId[];
  filter?: SeverityFilter;
}
