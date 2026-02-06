import { z } from "zod";
import {
  createDomainErrorSchema,
} from "../errors.js";

export const REVIEW_SEVERITY = ["blocker", "high", "medium", "low", "nit"] as const;
export const ReviewSeveritySchema = z.enum(REVIEW_SEVERITY);
export type ReviewSeverity = z.infer<typeof ReviewSeveritySchema>;

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

export const EvidenceRefSchema = z.object({
  type: EvidenceTypeSchema,
  title: z.string(),
  sourceId: z.string(),
  file: z.string().optional(),
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

export const FixPlanStepSchema = z.object({
  step: z.number(),
  action: z.string(),
  files: z.array(z.string()).optional(),
  risk: z.enum(["low", "medium", "high"]).optional(),
});
export type FixPlanStep = z.infer<typeof FixPlanStepSchema>;

export const GitBlameInfoSchema = z.object({
  author: z.string(),
  authorEmail: z.string(),
  commit: z.string(),
  commitDate: z.string(),
  summary: z.string(),
});
export type GitBlameInfo = z.infer<typeof GitBlameInfoSchema>;

export const FileContextSchema = z.object({
  beforeLines: z.array(z.string()),
  afterLines: z.array(z.string()),
  totalContext: z.number(),
});
export type FileContext = z.infer<typeof FileContextSchema>;

export const EnrichmentDataSchema = z.object({
  blame: GitBlameInfoSchema.nullable(),
  context: FileContextSchema.nullable(),
  enrichedAt: z.string(),
});
export type EnrichmentData = z.infer<typeof EnrichmentDataSchema>;

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
  enrichment: EnrichmentDataSchema.optional(),
});
export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;

export const ReviewResultSchema = z.object({
  summary: z.string(),
  issues: z.array(ReviewIssueSchema),
});
export type ReviewResult = z.infer<typeof ReviewResultSchema>;

const REVIEW_SPECIFIC_CODES = ["NO_DIFF", "AI_ERROR", "GENERATION_FAILED"] as const;

export const ReviewErrorSchema = createDomainErrorSchema(REVIEW_SPECIFIC_CODES);
export type ReviewError = z.infer<typeof ReviewErrorSchema>;

export const ReviewStreamEventSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("chunk"), content: z.string() }),
  z.object({ type: z.literal("lens_start"), lens: z.string(), index: z.number(), total: z.number() }),
  z.object({ type: z.literal("lens_complete"), lens: z.string() }),
  z.object({ type: z.literal("complete"), result: ReviewResultSchema, reviewId: z.string(), durationMs: z.number().optional() }).passthrough(),
  z.object({ type: z.literal("error"), error: ReviewErrorSchema }),
]);
export type ReviewStreamEvent = z.infer<typeof ReviewStreamEventSchema>;

// SeverityFilter defined here to avoid circular dependency with lens.ts
export const SeverityFilterSchema = z.object({
  minSeverity: ReviewSeveritySchema,
});
export type SeverityFilter = z.infer<typeof SeverityFilterSchema>;

import type { LensId, ReviewProfile } from "./lens.js";
export interface ReviewOptions {
  profile?: ReviewProfile;
  lenses?: LensId[];
  filter?: SeverityFilter;
}
