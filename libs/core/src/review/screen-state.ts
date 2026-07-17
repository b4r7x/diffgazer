import type { LensStat } from "../schemas/events/index.js";
import type { ReviewIssue, ReviewSeverity } from "../schemas/review/index.js";

/**
 * The phase vocabulary for a live review screen: streaming progress, then the
 * post-complete summary, then the full results pane. Both surfaces share this
 * single vocabulary (web drives it from URL state, the TUI from setState).
 */
export type ReviewScreenPhase = "streaming" | "summary" | "results";

export interface SavedReviewData {
  issues: ReviewIssue[];
  reviewId: string;
  durationMs: number | undefined;
  lensStats?: LensStat[];
  droppedDuplicates?: number;
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
}

/**
 * Pure query-state input for {@link resolveSavedReviewOutcome}, mapped from each
 * surface's saved-review query (TanStack on both) so this resolver stays
 * decoupled from the query library. `notFound` is the caller's pre-computed
 * "the error is a 404" check.
 */
export interface SavedReviewQueryState {
  status: "pending" | "success" | "error";
  review:
    | {
        metadata: { id: string; durationMs?: number | null };
        result?: { issues: ReviewIssue[] } | null;
        lensStats?: LensStat[];
        droppedDuplicates?: number;
        droppedBelowThreshold?: number;
        minSeverity?: ReviewSeverity;
      }
    | null
    | undefined;
  error: unknown;
  notFound: boolean;
}

export type SavedReviewOutcome =
  | { kind: "results"; data: SavedReviewData }
  | { kind: "fallback-to-stream" }
  | { kind: "report-error"; error: unknown }
  | { kind: "loading" }
  | { kind: "not-found" };

/**
 * Resolves how to present a reviewId-addressed saved review. Canonical behavior
 * is the web stack's: a stored result renders; a result-less saved review (or a
 * 404) falls back to a fresh live stream unless the stream itself already 404'd
 * (loop guard → not-found); any other query error is reported.
 */
export function resolveSavedReviewOutcome(
  queryState: SavedReviewQueryState,
  streamNotFound: boolean,
): SavedReviewOutcome {
  if (queryState.status === "success") {
    const review = queryState.review;
    if (review?.result) {
      return {
        kind: "results",
        data: {
          issues: review.result.issues,
          reviewId: review.metadata.id,
          durationMs: review.metadata.durationMs ?? undefined,
          lensStats: review.lensStats,
          droppedDuplicates: review.droppedDuplicates,
          droppedBelowThreshold: review.droppedBelowThreshold,
          minSeverity: review.minSeverity,
        },
      };
    }
    // Saved review exists but has no result. If the stream already 404'd, there
    // is nothing to show -- report not-found instead of looping the dead stream.
    if (streamNotFound) return { kind: "not-found" };
    return { kind: "fallback-to-stream" };
  }

  if (queryState.status === "error") {
    if (queryState.notFound) {
      // Same loop guard: stream already 404'd, saved also 404'd.
      if (streamNotFound) return { kind: "not-found" };
      return { kind: "fallback-to-stream" };
    }
    return { kind: "report-error", error: queryState.error };
  }

  return { kind: "loading" };
}
