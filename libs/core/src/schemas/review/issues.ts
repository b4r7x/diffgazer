import { z } from "zod";
import { createDomainErrorCodes, createDomainErrorSchema } from "../errors.js";
import { LENS_IDS, ReviewSeveritySchema } from "./enums.js";

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

const EVIDENCE_TYPE = ["code", "doc", "trace", "external"] as const;
/**
 * Row the server prints between discontiguous excerpt segments. Runs saved
 * before per-row line numbers existed carry this marker inside `excerpt` with
 * nothing else identifying the gap, so readers detect it by exact match.
 */
export const EVIDENCE_GAP_MARKER = "... [evidence gap] ...";
const EvidenceTypeSchema = z.enum(EVIDENCE_TYPE);
const NonBlankProviderTextSchema = z.string().trim().min(1);
const TrimmedProviderTextSchema = z.string().trim();
/**
 * An excerpt is verbatim source, so the indentation of its first line is part of
 * the evidence: a whole-string trim would flatten line one against the lines
 * below it. Blank padding lines and trailing whitespace still go, so the snippet
 * never renders a phantom row above or below the code.
 */
const ExcerptTextSchema = z
  .string()
  .overwrite((excerpt) => excerpt.replace(/^(?:[ \t]*\r?\n)+/, "").trimEnd());

const ProviderEvidenceRefSchema = z.object({
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
  excerpt: ExcerptTextSchema,
  sha: TrimmedProviderTextSchema.optional(),
});

const EvidenceRefSchema = ProviderEvidenceRefSchema.extend({
  /**
   * One source line number per excerpt row, `null` where a row stands in for
   * skipped lines instead of printing one. A windowed excerpt is not contiguous,
   * so numbering it from `range.start` would label real code with lines it does
   * not occupy. Absent on runs saved before per-row numbers existed and read
   * leniently for the same reason ranges are: a corrupt gutter number must not
   * cost the whole finding.
   */
  excerptLineNumbers: z.array(z.number().nullable()).optional(),
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

export const TraceRefSchema = z.object({
  step: z.number(),
  tool: z.string(),
  inputSummary: z.string(),
  outputSummary: z.string(),
  timestamp: z.string(),
  artifacts: z.array(z.string()).optional(),
});

const FixPlanRiskSchema = z.enum(["low", "medium", "high"]);
const FixPlanStepSchema = z.object({
  step: z.number(),
  action: z.string(),
  files: z.array(z.string()).optional(),
  risk: FixPlanRiskSchema.optional(),
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
  suggested_patch: z
    .string()
    .nullable()
    .describe(
      'A minimal unified diff ("--- a/<file>", "+++ b/<file>", numbered hunk headers like "@@ -2,3 +2,8 @@", "+"/"-" line prefixes), with a real newline character between every line (JSON "\\n" escapes) — never flattened onto one line; null if a correct diff is impractical.',
    ),
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

/**
 * A unified diff's leading and trailing whitespace is meaningful, so a patch is
 * stored byte-for-byte. A payload with no non-whitespace character at all is not
 * a patch, though, and must not open an empty Patch tab on either surface.
 */
export function hasSuggestedPatch(issue: Pick<ReviewIssue, "suggested_patch">): boolean {
  return issue.suggested_patch !== null && issue.suggested_patch.trim().length > 0;
}

// Provider responses need to reach the ingestion completeness gate one issue at
// a time. Keep the same shape and trim semantics as ReviewIssueSchema, but do
// not let one blank required field reject the entire paid lens response before
// the server can drop and account for that individual finding.
//
// Optional fields are read leniently for the same reason: JSON-mode routes see
// only the prompt, and strict routes receive every optional as nullable AND
// required (structured-output-schema.ts), so a conforming answer carries null
// for an optional it has nothing for. A null optional key is read as omitted,
// an omitted nullable key (the prompt's "null if not applicable") is read as
// null, a null or undefined list item is dropped and any other non-string item is
// coerced to a string, a malformed optional sub-field of an evidence ref or fix
// step is dropped (a blank file, and a blank or non-string files entry,
// included), a fix step without a string action and a trace entry that is not
// a well-formed ref are dropped, a fix step without a numeric step is numbered
// by its position among the kept steps, and an evidence ref's text that is not
// a string is read as blank so the server's completeness rule drops that ref,
// not the finding. The issue's own required fields and a ref's type stay
// strict. Every lenient read is a z.preprocess so the draft-7 projection and
// STRUCTURED_OUTPUT_SCHEMA_SHA256 stay byte-identical; none yields undefined
// for a present key, which canonicalJson rejects at save time.
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asList(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [value];
}

function coerceStringListItems(value: unknown): string[] {
  return asList(value).flatMap((item) => {
    if (item === null || item === undefined) return [];
    if (typeof item === "string") return [item];
    return [typeof item === "object" ? JSON.stringify(item) : String(item)];
  });
}

const ProviderStringListSchema = z
  .preprocess(coerceStringListItems, z.array(z.string()))
  .optional();

type LooseFixPlanStep = { action: string; step?: unknown; files?: unknown; risk?: unknown };

function coerceFixPlanSteps(value: unknown): FixPlanStep[] {
  const readable = asList(value).flatMap((item): LooseFixPlanStep[] => {
    if (typeof item === "string") return [{ action: item }];
    if (isRecord(item) && typeof item.action === "string") {
      return [{ action: item.action, step: item.step, files: item.files, risk: item.risk }];
    }
    return [];
  });
  return readable.map((raw, index) => {
    const step: FixPlanStep = {
      step: typeof raw.step === "number" ? raw.step : index + 1,
      action: raw.action,
    };
    if (raw.files !== undefined && raw.files !== null) {
      step.files = asList(raw.files).filter(
        (file): file is string => typeof file === "string" && file.trim() !== "",
      );
    }
    const risk = FixPlanRiskSchema.safeParse(
      typeof raw.risk === "string" ? raw.risk.toLowerCase() : raw.risk,
    );
    if (risk.success) step.risk = risk.data;
    return step;
  });
}

function coerceEvidenceRef(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const { type, title, sourceId, excerpt, file, range, sha } = value;
  const ref: Record<string, unknown> = {
    type,
    title: typeof title === "string" ? title : "",
    sourceId: typeof sourceId === "string" ? sourceId : "",
    excerpt: typeof excerpt === "string" ? excerpt : "",
  };
  if (typeof file === "string" && file.trim() !== "") ref.file = file;
  if (isRecord(range) && typeof range.start === "number" && typeof range.end === "number") {
    ref.range = range;
  }
  if (typeof sha === "string") ref.sha = sha;
  return ref;
}

const ProviderReviewIssueFieldsSchema = ReviewIssueSchema.extend({
  id: TrimmedProviderTextSchema,
  title: TrimmedProviderTextSchema,
  file: TrimmedProviderTextSchema,
  rationale: TrimmedProviderTextSchema,
  recommendation: TrimmedProviderTextSchema,
  symptom: TrimmedProviderTextSchema,
  whyItMatters: TrimmedProviderTextSchema,
  fixPlan: z.preprocess(coerceFixPlanSteps, z.array(FixPlanStepSchema)).optional(),
  betterOptions: ProviderStringListSchema,
  testsToAdd: ProviderStringListSchema,
  // This schema is also the provider response schema. Per-row gutter numbers are
  // synthesized from the diff after the call, so asking a model for them would
  // only spend tokens on numbers the server discards.
  evidence: z.array(z.preprocess(coerceEvidenceRef, ProviderEvidenceRefSchema)),
  trace: z
    .preprocess(
      (value) => asList(value).filter((entry) => TraceRefSchema.safeParse(entry).success),
      z.array(TraceRefSchema),
    )
    .optional(),
});

const PROVIDER_OPTIONAL_ISSUE_KEYS = Object.entries(ProviderReviewIssueFieldsSchema.shape)
  .filter(([, field]) => field instanceof z.ZodOptional)
  .map(([key]) => key);

const PROVIDER_NULLABLE_ISSUE_KEYS = Object.entries(ProviderReviewIssueFieldsSchema.shape)
  .filter(([, field]) => field instanceof z.ZodNullable)
  .map(([key]) => key);

function normalizeIssueKeys(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const issue = { ...value };
  for (const key of PROVIDER_OPTIONAL_ISSUE_KEYS) {
    if (issue[key] === null) delete issue[key];
  }
  for (const key of PROVIDER_NULLABLE_ISSUE_KEYS) {
    if (!(key in issue)) issue[key] = null;
  }
  return issue;
}

export const ProviderReviewIssueSchema = z.preprocess(
  normalizeIssueKeys,
  ProviderReviewIssueFieldsSchema,
);

/** Provider-response cap for one lens analysis. */
export const MAX_REVIEW_ISSUES_PER_LENS = 256;
/** Final-result cap across every member of the closed lens enum. */
export const MAX_REVIEW_ISSUES = MAX_REVIEW_ISSUES_PER_LENS * LENS_IDS.length;

// Top-level tolerance mirrors the lenient line-number reads above: an extra
// top-level key ("summary", "overall", ...) is stripped, not a reason to void
// the whole paid lens response. The strict provider wire schema still forbids
// extra keys for capable routes (structured-output-schema.ts forces
// additionalProperties: false); this only widens the local validation.
export const LensReviewResultSchema = z.object({
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
  TRUST_REQUIRED: "TRUST_REQUIRED",
  /** The admitted model could not produce Diffgazer's structured review output. */
  MODEL_INCOMPATIBLE: "MODEL_INCOMPATIBLE",
  /** The provider refused the request (credential, billing, model, or rate limit). */
  PROVIDER_REJECTED: "PROVIDER_REJECTED",
  /** The review spent its configured budget before every lens had run. */
  BUDGET_EXHAUSTED: "BUDGET_EXHAUSTED",
  /**
   * The diff is past what one review can read: the selected model's context
   * window, or the hard byte ceiling. Distinct from `GENERATION_FAILED` because
   * a narrower file set is the remedy, and a screen may offer it.
   */
  DIFF_TOO_LARGE: "DIFF_TOO_LARGE",
} as const;

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
  ReviewErrorCode.TRUST_REQUIRED,
  ReviewErrorCode.MODEL_INCOMPATIBLE,
  ReviewErrorCode.PROVIDER_REJECTED,
  ReviewErrorCode.BUDGET_EXHAUSTED,
  ReviewErrorCode.DIFF_TOO_LARGE,
] as const;

const REVIEW_ERROR_CODES = createDomainErrorCodes(REVIEW_SPECIFIC_CODES);

/**
 * Every code `ReviewErrorSchema` accepts, so the named type and the wire
 * vocabulary cannot drift: the shared codes the domain helper prepends belong to
 * a review error too, even though the constant above only names review-owned ones.
 */
export type ReviewErrorCode = (typeof REVIEW_ERROR_CODES)[number];

export const ReviewErrorSchema = createDomainErrorSchema(REVIEW_SPECIFIC_CODES);
/** @see cli/server/src/features/review/engine/types.ts ReviewError (lightweight server-internal variant) */
export type ReviewError = z.infer<typeof ReviewErrorSchema>;

/**
 * The advisory a review start carries when the diff fits the selected model's
 * context window but is large enough that a single review call reads it poorly.
 * It is not a gate — the review runs — so the numbers travel with the message
 * and every surface can state the same ones instead of paraphrasing the size.
 *
 * `contextTokens` and `modelId` are null when no admitted model is known or the
 * bundled catalog states no window for it; the estimate is still reported.
 */
export const ReviewSizeWarningSchema = z.object({
  message: z.string().min(1).max(600),
  diffBytes: z.int().nonnegative(),
  estimatedInputTokens: z.int().nonnegative(),
  contextTokens: z.int().positive().nullable(),
  modelId: z.string().min(1).max(128).nullable(),
  // Present only when the review had to be split: how many batches it runs and
  // what the whole run is estimated to cost in input tokens. Absent on the
  // single-call advisory, and on every warning saved before batching existed.
  batchCount: z.int().positive().optional(),
  estimatedTotalInputTokens: z.int().nonnegative().optional(),
});
export type ReviewSizeWarning = z.infer<typeof ReviewSizeWarningSchema>;

export const ReviewStreamEventSchema = z.discriminatedUnion("type", [
  // `chunk` carries the server's event-cap warning to the client; it is the only
  // free-text member with a no-op effect on UI step/agent state.
  z.object({ type: z.literal("chunk"), content: z.string() }),
  // Emitted once, right after `review_started`, for a run that was admitted with
  // a warning. It changes no step or agent state.
  z.object({ type: z.literal("review_size_warning"), warning: ReviewSizeWarningSchema }),
  // No duration on the wire: the client measures the elapsed time the user
  // actually saw, and the server's own measurement is persisted on
  // `ReviewMetadata.durationMs` for the history screen to read back.
  z.object({
    type: z.literal("complete"),
    result: ReviewResultSchema,
    reviewId: z.string(),
  }),
  z.object({ type: z.literal("error"), error: ReviewErrorSchema }),
]);
export type ReviewStreamEvent = z.infer<typeof ReviewStreamEventSchema>;

export type { SeverityFilter } from "./enums.js";
