import type { LensStat } from "@diffgazer/core/schemas/events";
import type {
  Lens,
  ReviewIssue,
  ReviewSeverity,
  SelectableLensId,
  SeverityFilter,
} from "@diffgazer/core/schemas/review";
import type { AIError } from "../../../shared/lib/ai/types.js";
import type { ParsedDiff } from "./diff/types.js";

export type LensDispatch = NonNullable<LensStat["dispatches"]>[number];

export interface LensResult {
  lensId: Lens["id"];
  issues: ReviewIssue[];
  droppedIncompleteProviderIssues: number;
  /** One entry per model call this lens made, in dispatch order. */
  dispatches: LensDispatch[];
  /**
   * Issues a batched lens found past the per-lens cap, which the concatenated
   * batches are trimmed to. A single call cannot overflow it.
   */
  droppedOverLensCap?: number;
  /**
   * Set when a batch failed after earlier batches had already returned findings.
   * Dispatching stops there, but what the earlier batches found is already paid
   * for, so the lens reports those issues beside the error that ended it.
   */
  batchError?: ReviewError;
}

/** @see @diffgazer/core/schemas/review ReviewError (Zod-validated full variant with domain error codes) */
export type ReviewError = { code: string; message: string };

/** A failed lens dispatch, still carrying the timing entries the run collected. */
export type LensAnalysisError = AIError & { dispatches: LensDispatch[] };

/** A failed review, still carrying the per-lens stats the run collected. */
export type OrchestrationError = ReviewError & {
  lensStats: LensStat[];
  /**
   * Every lens ran and every one failed structured output — the unanimous
   * verdict the pipeline reports as `schema-failed` and the only failure shape
   * allowed to arm the conformance fail-fast memo. Absent on mixed or
   * non-schema failures.
   */
  allLensesSchemaFailed?: true;
};

/** Lens selection already resolved by `resolveReviewDefaults`; the engine applies it as given. */
export interface LensSelection {
  lenses: SelectableLensId[];
  filter?: SeverityFilter;
}

export type OrchestrationOutcome = {
  issues: ReviewIssue[];
  lensStats: LensStat[];
  droppedDuplicates: number;
  droppedBelowThreshold: number;
  minSeverity?: ReviewSeverity;
};

export interface OrchestrationOptions {
  concurrency: number;
  /** The concurrency the user asked for, when a provider profile clamped it below. */
  requestedConcurrency?: number;
  /**
   * The review's elapsed wall clock. Its signal aborts in-flight dispatches when
   * the clock runs out; `expired()` is true only for the clock's own timeout,
   * never for caller cancellation.
   */
  reviewClock?: { signal: AbortSignal; expired(): boolean };
  /**
   * The whole-file batches from the size gate's plan, which every lens reads in
   * turn. Absent is the same review as a one-entry plan: the diff read whole, in
   * one call per lens.
   */
  batches?: readonly ParsedDiff[];
  projectContext?: string;
  signal?: AbortSignal;
}
