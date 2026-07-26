import type { LensStat } from "@diffgazer/core/schemas/events";
import type {
  Lens,
  LensId,
  ReviewIssue,
  ReviewSeverity,
  SeverityFilter,
} from "@diffgazer/core/schemas/review";

export interface LensResult {
  lensId: Lens["id"];
  issues: ReviewIssue[];
  droppedIncompleteProviderIssues: number;
}

/** @see @diffgazer/core/schemas/review ReviewError (Zod-validated full variant with domain error codes) */
export type ReviewError = { code: string; message: string };

/** Lens selection already resolved by `resolveReviewDefaults`; the engine applies it as given. */
export interface LensSelection {
  lenses: LensId[];
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
  projectContext?: string;
  signal?: AbortSignal;
}
