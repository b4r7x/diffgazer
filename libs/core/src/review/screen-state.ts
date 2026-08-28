import { isApiError } from "../api/types.js";
import type { RunnableProductId } from "../schemas/config/transports.js";
import type { LensStat } from "../schemas/events/index.js";
import type {
  ExecutionReceipt,
  LensId,
  ReviewIssue,
  ReviewMode,
  ReviewResponse,
  ReviewSeverity,
  TerminalOutcome,
  UsageAvailability,
} from "../schemas/review/index.js";

/**
 * The phase vocabulary for a live review screen: streaming progress, then the
 * post-complete summary, then the full results pane. Both surfaces share this
 * single vocabulary (web drives it from URL state, the TUI from setState).
 */
export type ReviewScreenPhase = "streaming" | "summary" | "results";

/**
 * What a saved run can show without its findings. The receipt fields — scope,
 * size, model, when — are the evidence a zero-issue run has instead of issues,
 * so they travel with every saved review rather than only the ones that found
 * something. Each is optional at the source: a legacy record may lack a mode,
 * a git context, or an execution receipt.
 */
export interface SavedReviewData {
  issues: ReviewIssue[];
  reviewId: string;
  durationMs: number | undefined;
  mode: ReviewMode | undefined;
  createdAt: string | undefined;
  lenses: LensId[] | undefined;
  fileCount: number | undefined;
  additions: number | undefined;
  deletions: number | undefined;
  /** Paired so the receipt can name the model against the product that ran it. */
  productId: RunnableProductId | undefined;
  modelId: string | undefined;
  lensStats?: LensStat[];
  droppedDuplicates?: number;
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
}

export interface SavedReviewRecord {
  metadata: {
    id: string;
    durationMs?: number | null;
    mode?: ReviewMode;
    createdAt?: string;
    lenses?: LensId[];
    fileCount?: number;
  };
  gitContext?: { additions?: number; deletions?: number };
  result?: { issues: ReviewIssue[] } | null;
  executionSnapshot?: {
    receipt: ExecutionReceipt;
  };
  execution?: {
    receipt: ExecutionReceipt;
  };
  lensStats?: LensStat[];
  droppedDuplicates?: number;
  droppedBelowThreshold?: number;
  minSeverity?: ReviewSeverity;
}

/**
 * Pure query-state input for {@link resolveSavedReviewOutcome}, mapped from each
 * surface's saved-review query (TanStack on both) so this resolver stays
 * decoupled from the query library. Keeping the status as the discriminant means
 * an error can never arrive dressed as a result-less success. `notFound` is the
 * caller's pre-computed "the error is a 404" check.
 */
export type SavedReviewQueryState =
  | { status: "pending" }
  | { status: "success"; review: SavedReviewRecord | null }
  | { status: "error"; error: unknown; notFound: boolean };

/** The subset of a TanStack query result this adapter reads, discriminant intact. */
export type SavedReviewQuery =
  | { status: "pending" }
  | { status: "success"; data: ReviewResponse | undefined }
  | { status: "error"; error: unknown };

export function toSavedReviewQueryState(query: SavedReviewQuery): SavedReviewQueryState {
  if (query.status === "success") {
    return { status: "success", review: query.data?.review ?? null };
  }
  if (query.status === "error") {
    return {
      status: "error",
      error: query.error,
      notFound: isApiError(query.error) && query.error.status === 404,
    };
  }
  return { status: "pending" };
}

/** Every terminal outcome except the one that means the review actually finished. */
export type FailedTerminalOutcome = Exclude<TerminalOutcome, "completed">;

/**
 * A terminal run is still a run: it carries the same saved data as a completed
 * one so the saved route can render how far it got -- lens outcomes and any
 * findings the server kept -- instead of a bare receipt.
 */
interface SavedReviewTerminalData extends SavedReviewData {
  outcome: FailedTerminalOutcome;
  usageAvailability: UsageAvailability;
}

export type SavedReviewOutcome =
  | { kind: "results"; data: SavedReviewData }
  | { kind: "terminal"; data: SavedReviewTerminalData }
  | { kind: "fallback-to-stream" }
  | { kind: "report-error"; error: unknown }
  | { kind: "loading" }
  | { kind: "not-found" };

function toSavedReviewData(review: SavedReviewRecord): SavedReviewData {
  const receipt = review.executionSnapshot?.receipt ?? review.execution?.receipt;
  return {
    issues: review.result?.issues ?? [],
    reviewId: review.metadata.id,
    durationMs: review.metadata.durationMs ?? undefined,
    mode: review.metadata.mode,
    createdAt: review.metadata.createdAt,
    lenses: review.metadata.lenses,
    fileCount: review.metadata.fileCount,
    additions: review.gitContext?.additions,
    deletions: review.gitContext?.deletions,
    productId: receipt?.productId,
    modelId: receipt?.modelId,
    lensStats: review.lensStats,
    droppedDuplicates: review.droppedDuplicates,
    droppedBelowThreshold: review.droppedBelowThreshold,
    minSeverity: review.minSeverity,
  };
}

function resolveTerminalExecution(review: SavedReviewRecord): SavedReviewTerminalData | null {
  const receipt = review.executionSnapshot?.receipt ?? review.execution?.receipt;
  if (!receipt || receipt.outcome === "completed") return null;

  return {
    ...toSavedReviewData(review),
    outcome: receipt.outcome,
    usageAvailability: receipt.usageAvailability,
  };
}

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
    const terminal = review ? resolveTerminalExecution(review) : null;
    if (terminal) {
      return { kind: "terminal", data: terminal };
    }
    if (review?.result) {
      return { kind: "results", data: toSavedReviewData(review) };
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
