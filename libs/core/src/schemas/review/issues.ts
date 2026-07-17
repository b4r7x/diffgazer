import { z } from "zod";
import { createDomainErrorSchema } from "../errors.js";
import {
  LENS_IDS,
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
const NonBlankProviderTextSchema = z.string().trim().min(1);
const TrimmedProviderTextSchema = z.string().trim();

const EvidenceRefSchema = z.object({
  type: EvidenceTypeSchema,
  title: TrimmedProviderTextSchema,
  sourceId: TrimmedProviderTextSchema,
  file: TrimmedProviderTextSchema.optional(),
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
  excerpt: TrimmedProviderTextSchema,
  sha: TrimmedProviderTextSchema.optional(),
});
export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export function isValidEvidenceRange(
  range: EvidenceRef["range"],
): range is NonNullable<EvidenceRef["range"]> {
  return (
    range !== undefined &&
    Number.isInteger(range.start) &&
    range.start > 0 &&
    Number.isInteger(range.end) &&
    range.end >= range.start
  );
}

const EVIDENCE_PRESENTATION_LABELS = {
  code: "Code evidence",
  doc: "Documentation",
  trace: "Trace evidence",
  external: "External reference",
} as const satisfies Record<EvidenceRef["type"], string>;

interface EvidencePresentationBase {
  title: string;
  sourceText: string;
  excerpt: string;
  ordinal: number;
}

export type EvidencePresentation =
  | (EvidencePresentationBase & {
      kind: "code";
      type: "code";
      label: (typeof EVIDENCE_PRESENTATION_LABELS)["code"];
      file: string;
      startLine?: number;
    })
  | (EvidencePresentationBase & {
      kind: "reference";
      type: "doc";
      label: (typeof EVIDENCE_PRESENTATION_LABELS)["doc"];
    })
  | (EvidencePresentationBase & {
      kind: "reference";
      type: "trace";
      label: (typeof EVIDENCE_PRESENTATION_LABELS)["trace"];
    })
  | (EvidencePresentationBase & {
      kind: "reference";
      type: "external";
      label: (typeof EVIDENCE_PRESENTATION_LABELS)["external"];
    });

export function toEvidencePresentation(
  evidence: EvidenceRef,
  fallbackCodeFile: string,
  ordinal: number,
): EvidencePresentation {
  const base = {
    title: evidence.title,
    sourceText: evidence.sourceId,
    excerpt: evidence.excerpt,
    ordinal,
  };

  switch (evidence.type) {
    case "code":
      return {
        ...base,
        kind: "code",
        type: "code",
        label: EVIDENCE_PRESENTATION_LABELS.code,
        file: evidence.file ?? fallbackCodeFile,
        startLine: isValidEvidenceRange(evidence.range) ? evidence.range.start : undefined,
      };
    case "doc":
      return {
        ...base,
        kind: "reference",
        type: "doc",
        label: EVIDENCE_PRESENTATION_LABELS.doc,
      };
    case "trace":
      return {
        ...base,
        kind: "reference",
        type: "trace",
        label: EVIDENCE_PRESENTATION_LABELS.trace,
      };
    case "external":
      return {
        ...base,
        kind: "reference",
        type: "external",
        label: EVIDENCE_PRESENTATION_LABELS.external,
      };
  }
}

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
  id: NonBlankProviderTextSchema,
  severity: ReviewSeveritySchema,
  category: ReviewCategorySchema,
  title: NonBlankProviderTextSchema,
  file: NonBlankProviderTextSchema,
  line_start: z.number().nullable(),
  line_end: z.number().nullable(),
  rationale: NonBlankProviderTextSchema,
  recommendation: NonBlankProviderTextSchema,
  suggested_patch: z.string().nullable(),
  confidence: z.number().min(0).max(1),
  symptom: NonBlankProviderTextSchema,
  whyItMatters: NonBlankProviderTextSchema,
  fixPlan: z.array(FixPlanStepSchema).optional(),
  betterOptions: z.array(z.string()).optional(),
  testsToAdd: z.array(z.string()).optional(),
  evidence: z.array(EvidenceRefSchema),
  trace: z.array(TraceRefSchema).optional(),
});
export type ReviewIssue = z.infer<typeof ReviewIssueSchema>;

// Provider responses need to reach the ingestion completeness gate one issue at
// a time. Keep the same shape and trim semantics as ReviewIssueSchema, but do
// not let one blank required field reject the entire paid lens response before
// the server can drop and account for that individual finding.
const ProviderReviewIssueSchema = ReviewIssueSchema.extend({
  id: TrimmedProviderTextSchema,
  title: TrimmedProviderTextSchema,
  file: TrimmedProviderTextSchema,
  rationale: TrimmedProviderTextSchema,
  recommendation: TrimmedProviderTextSchema,
  symptom: TrimmedProviderTextSchema,
  whyItMatters: TrimmedProviderTextSchema,
});

/** Provider-response cap for one lens analysis. */
export const MAX_REVIEW_ISSUES_PER_LENS = 256;
/** Final-result cap across every member of the closed lens enum. */
export const MAX_REVIEW_ISSUES = MAX_REVIEW_ISSUES_PER_LENS * LENS_IDS.length;

export const LensReviewResultSchema = z.strictObject({
  issues: z.array(ProviderReviewIssueSchema).max(MAX_REVIEW_ISSUES_PER_LENS),
});
export type LensReviewResult = z.infer<typeof LensReviewResultSchema>;

export const ReviewResultSchema = z.strictObject({
  issues: z.array(ReviewIssueSchema).max(MAX_REVIEW_ISSUES),
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
/** @see cli/server/src/features/review/engine/types.ts ReviewError (lightweight server-internal variant) */
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
