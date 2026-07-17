import type { LensStat } from "@diffgazer/core/schemas/events";
import type { Lens, LensId, ReviewIssue, ReviewSeverity } from "@diffgazer/core/schemas/review";

export interface LensResult {
  lensId: Lens["id"];
  issues: ReviewIssue[];
  droppedIncompleteProviderIssues: number;
}

/** @see @diffgazer/core/schemas/review ReviewError (Zod-validated full variant with domain error codes) */
export type ReviewError = { code: string; message: string };

export type OrchestrationOutcome = {
  issues: ReviewIssue[];
  lensStats: LensStat[];
  failedLenses: Array<{ lensId: LensId; errorCode?: string; errorMessage?: string }>;
  droppedDuplicates: number;
  droppedBelowThreshold: number;
  droppedIncompleteProviderIssues: number;
  minSeverity?: ReviewSeverity;
};

export interface OrchestrationOptions {
  concurrency: number;
  projectContext?: string;
  /**
   * When true, returns ok() with an empty partial result even when all lenses fail.
   * When false, returns err(lastError) when all lenses fail and no issues were found.
   */
  partialOnAllFailed?: boolean;
  signal?: AbortSignal;
}
