import { randomUUID } from "node:crypto";
import { ok, type Result } from "@diffgazer/core/result";
import type {
  ReviewGitContext,
  ReviewListWarning,
  ReviewMetadata,
  SavedReview,
} from "@diffgazer/core/schemas/review";
import {
  calculateSeverityCounts,
  toSavedReviewExecutionSnapshot,
} from "@diffgazer/core/schemas/review";
import { log } from "../../../shared/lib/log.js";
import { appendSalvageWarnings, scanReviewsForCertification } from "./list-page.js";
import {
  countFailedLenses,
  migrateReview,
  persistMigrationLocked,
  presentDurableReviewRead,
} from "./migrate.js";
import {
  addToProjectIndex,
  invalidateProjectIndex,
  markProjectReconcile,
} from "./project-index.js";
import { reviewStore } from "./store.js";
import type { SaveReviewOptions, StoreError } from "./types.js";

export async function saveReview(
  options: SaveReviewOptions,
): Promise<Result<ReviewMetadata, StoreError>> {
  const now = new Date().toISOString();

  const gitContext: ReviewGitContext = {
    branch: options.branch,
    commit: options.commit,
    fileCount: options.diff.totalStats.filesChanged,
    additions: options.diff.totalStats.additions,
    deletions: options.diff.totalStats.deletions,
  };

  const severityCounts = calculateSeverityCounts(options.result.issues);
  const failedLensCount = countFailedLenses(options.lensStats);
  const terminalOutcome = options.execution?.receipt.outcome ?? options.terminalOutcome;

  const metadata: ReviewMetadata = {
    id: options.reviewId ?? randomUUID(),
    projectPath: options.projectPath,
    createdAt: now,
    mode: options.mode,
    branch: options.branch,
    profile: options.profile ?? null,
    lenses: options.lenses,
    issueCount: options.result.issues.length,
    failedLensCount,
    blockerCount: severityCounts.blocker,
    highCount: severityCounts.high,
    mediumCount: severityCounts.medium,
    lowCount: severityCounts.low,
    nitCount: severityCounts.nit,
    fileCount: options.diff.totalStats.filesChanged,
    ...(options.durationMs === undefined ? {} : { durationMs: options.durationMs }),
    ...(terminalOutcome ? { terminalOutcome } : {}),
  };

  const savedReview: SavedReview = {
    metadata,
    result: options.result,
    diff: options.diff,
    gitContext,
    ...(options.lensStats ? { lensStats: options.lensStats } : {}),
    ...(options.droppedDuplicates !== undefined
      ? { droppedDuplicates: options.droppedDuplicates }
      : {}),
    ...(options.droppedBelowThreshold !== undefined
      ? { droppedBelowThreshold: options.droppedBelowThreshold }
      : {}),
    ...(options.minSeverity !== undefined ? { minSeverity: options.minSeverity } : {}),
    ...(options.execution
      ? {
          execution: options.execution,
          executionSnapshot: toSavedReviewExecutionSnapshot(options.execution),
        }
      : {}),
  };

  const writeResult = await reviewStore.write(savedReview);
  if (!writeResult.ok) return writeResult;
  // The review file is the durable record; the index is a derived discovery cache.
  // On append failure, drop the now-stale index so the next listing rebuilds it from
  // a full scan; the durable save still succeeds.
  try {
    await addToProjectIndex(metadata, scanReviewsForCertification);
  } catch (error) {
    log("warn", "reviews_index_add_failed", { error });
    const invalidated = await invalidateProjectIndex(options.projectPath)
      .then(() => true)
      .catch((e) => {
        log("warn", "reviews_index_invalidate_failed", { error: e });
        return false;
      });
    // If invalidation also failed, the stale index would hide this durable save; drop
    // a reconcile marker so the next listing merges it back in.
    if (!invalidated) {
      await markProjectReconcile(options.projectPath).catch((e) =>
        log("warn", "reviews_index_mark_reconcile_failed", { error: e }),
      );
    }
  }
  return ok(metadata);
}

export interface ReviewDetail {
  review: SavedReview;
  warnings: ReviewListWarning[];
}

/**
 * Reads one review together with the recoverable-corruption warnings the listing
 * path also reports, so the detail surface never presents a silently reduced
 * issue set as a clean record.
 */
export async function getReviewDetail(reviewId: string): Promise<Result<ReviewDetail, StoreError>> {
  const result = await reviewStore.readDetailed(reviewId);
  if (!result.ok) return result;

  const stored = result.value.item;
  const warnings: ReviewListWarning[] = [];
  if (result.value.diagnostics?.droppedIssueCount) {
    log("warn", "review_issues_salvaged", {
      reviewId,
      droppedIssueCount: result.value.diagnostics.droppedIssueCount,
    });
  }
  appendSalvageWarnings(warnings, stored.metadata, result.value.diagnostics);
  if (!result.value.salvaged && migrateReview(stored)) {
    void persistMigrationLocked(stored.metadata.id);
  }
  return ok({ review: presentDurableReviewRead(stored), warnings });
}
