import { lensAnsweredIncompletely } from "@diffgazer/core/review";
import type { ReviewMetadata, SavedReview } from "@diffgazer/core/schemas/review";
import {
  calculateSeverityCounts,
  toSavedReviewExecutionSnapshot,
} from "@diffgazer/core/schemas/review";
import { log } from "../../../shared/lib/log.js";
import { dropUntrustedFindings } from "./lenient-read.js";
import { withReviewLock } from "./lock.js";
import { reviewStore } from "./store.js";

export function countFailedLenses(lensStats: SavedReview["lensStats"]): number {
  return lensStats?.filter((lens) => lens.status === "failed").length ?? 0;
}

export function countSalvagedLenses(lensStats: SavedReview["lensStats"]): number {
  return lensStats?.filter(lensAnsweredIncompletely).length ?? 0;
}

export function presentDurableReviewRead(review: SavedReview): SavedReview {
  const migrated = migrateReview(review);
  return dropUntrustedFindings(migrated ?? review);
}

export function presentDurableReviewMetadata(review: SavedReview): ReviewMetadata {
  return dropUntrustedFindings(review).metadata;
}

export function migrateReview(review: SavedReview): SavedReview | null {
  const { metadata } = review;
  const { issues } = review.result;
  const totalCounted =
    metadata.blockerCount +
    metadata.highCount +
    metadata.mediumCount +
    metadata.lowCount +
    metadata.nitCount;
  const needsFailedLensCount = metadata.failedLensCount === undefined;
  const needsSeverityCounts = issues.length > 0 && metadata.issueCount > 0 && totalCounted === 0;
  const needsExecutionSnapshot =
    review.execution !== undefined && review.executionSnapshot === undefined;

  if (!needsFailedLensCount && !needsSeverityCounts && !needsExecutionSnapshot) return null;

  const counts = needsSeverityCounts ? calculateSeverityCounts(issues) : null;
  return {
    ...review,
    metadata: {
      ...metadata,
      ...(needsFailedLensCount ? { failedLensCount: countFailedLenses(review.lensStats) } : {}),
      ...(counts
        ? {
            blockerCount: counts.blocker,
            highCount: counts.high,
            mediumCount: counts.medium,
            lowCount: counts.low,
            nitCount: counts.nit,
          }
        : {}),
    },
    ...(needsExecutionSnapshot && review.execution
      ? { executionSnapshot: toSavedReviewExecutionSnapshot(review.execution) }
      : {}),
  };
}

// Re-read inside the lock so this background write preserves a concurrent
// project-path rekey.
export function persistMigrationLocked(reviewId: string): Promise<void> {
  return withReviewLock(reviewId, async () => {
    const current = await reviewStore.readDetailed(reviewId);
    if (!current.ok) return;
    if (current.value.salvaged) return;
    const migrated = migrateReview(current.value.item);
    if (!migrated) return;
    await reviewStore.write(migrated);
  }).catch((e) => log("warn", "reviews_migration_write_failed", { error: e }));
}
