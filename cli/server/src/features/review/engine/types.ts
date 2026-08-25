import type { LensStat } from "@diffgazer/core/schemas/events";
import type {
  Lens,
  ReviewIssue,
  ReviewSeverity,
  SelectableLensId,
  SeverityFilter,
} from "@diffgazer/core/schemas/review";
import type { ParsedDiff } from "./diff/types.js";

export interface LensResult {
  lensId: Lens["id"];
  issues: ReviewIssue[];
  droppedIncompleteProviderIssues: number;
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
  /**
   * The whole-file batches from the size gate's plan, which every lens reads in
   * turn. Absent is the same review as a one-entry plan: the diff read whole, in
   * one call per lens.
   */
  batches?: readonly ParsedDiff[];
  projectContext?: string;
  signal?: AbortSignal;
}
