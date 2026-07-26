import { unlink } from "node:fs/promises";
import type { ReviewMetadata, SavedReview } from "@diffgazer/core/schemas/review";
import { isNodeError } from "../../../shared/lib/fs.js";
import { log } from "../../../shared/lib/log.js";
import {
  clearCursorIndexMarker,
  clearReconcileMarker,
  emptyProjectIndexData,
  hasCursorIndexMarker,
  hasReconcileMarker,
  invalidateCachedProjectIndex,
  invalidateProjectIndex,
  markProjectReconcile,
  projectIndexPath,
  readProjectIndexData,
  withProjectIndexLock,
  writeCursorProjectIndex,
} from "./project-index.js";
import { withReviewLock } from "./review-lock.js";
import { reviewStore } from "./review-store.js";
import { scanReviewsForCertification } from "./reviews.js";

// Move a project's stored review history to a new path (repo dir moved/renamed):
// rewrite each matching review's metadata.projectPath under its lock and migrate the
// sha256(projectPath) index file to the new key.
//
// Invariant every branch below upholds: the source index may only be deleted once the
// destination index provably contains every id this pass claimed, so an interrupted
// move always leaves a durable retry set behind.
export async function rekeyProjectReviews(
  oldProjectPath: string,
  newProjectPath: string,
): Promise<boolean> {
  if (oldProjectPath === newProjectPath) return true;

  const [indexResult, needsReconcile, isCursorOrdered] = await Promise.all([
    readProjectIndexData(oldProjectPath),
    hasReconcileMarker(oldProjectPath),
    hasCursorIndexMarker(oldProjectPath),
  ]);
  const { entries, isCanonical } =
    indexResult.kind === "valid" ? indexResult.data : emptyProjectIndexData();
  const hasCertifiedIndex = !needsReconcile && isCursorOrdered && entries !== null && isCanonical;
  const ids = hasCertifiedIndex
    ? entries.map((entry) => entry.id)
    : await scanProjectReviewIds(oldProjectPath);

  const rekeyed: ReviewMetadata[] = [];
  let isRecoveryAttempt = false;
  let migrationFailed = false;
  for (const id of ids) {
    const moved = await withReviewLock(id, async () => {
      const current = await reviewStore.readDetailed(id);
      if (!current.ok) {
        // Same skip semantics as scanReviewsForCertification: a review file that is
        // missing or unreadable as data can never be migrated, so it must not wedge
        // the whole rekey. migrationFailed is reserved for I/O failures a retry can
        // still resolve.
        const { code } = current.error;
        if (code === "PARSE_ERROR" || code === "VALIDATION_ERROR") {
          log("warn", "reviews_rekey_unreadable_review_skipped", { id, code });
        } else if (code !== "NOT_FOUND") {
          migrationFailed = true;
        }
        return null;
      }
      const review = current.value.item;
      // A previous attempt may have durably moved the review but failed while
      // merging the destination index. Keep it in the retry set until that
      // merge succeeds and the retained source index can be removed safely.
      if (review.metadata.projectPath === newProjectPath) {
        isRecoveryAttempt = true;
        return review.metadata;
      }
      if (review.metadata.projectPath !== oldProjectPath) return null;
      const next: SavedReview = {
        ...review,
        metadata: { ...review.metadata, projectPath: newProjectPath },
      };
      const writeResult = await reviewStore.write(next);
      if (!writeResult.ok) {
        migrationFailed = true;
        return null;
      }
      return next.metadata;
    });
    if (moved) rekeyed.push(moved);
    // A retryable failure leaves the remaining reviews unmovable for the same reason,
    // so stop rewriting files and let the retained source index drive the retry.
    if (migrationFailed) break;
  }

  if (migrationFailed) {
    // The reviews this pass already rewrote now point at the destination. Publish them
    // there so the aborted pass does not leave them unlisted; the source index stays as
    // the durable retry set for the ids that have not moved yet.
    await publishRekeyedToDestination(newProjectPath, rekeyed, false);
    return false;
  }

  return migrateProjectIndexFile(oldProjectPath, newProjectPath, rekeyed, isRecoveryAttempt);
}

async function scanProjectReviewIds(projectPath: string): Promise<string[]> {
  return (await scanReviewsForCertification(projectPath)).map((metadata) => metadata.id);
}

async function migrateProjectIndexFile(
  oldProjectPath: string,
  newProjectPath: string,
  rekeyedItems: ReviewMetadata[],
  isRecoveryAttempt: boolean,
): Promise<boolean> {
  // Only the reviews this rekey actually claimed for the destination have to show
  // up there. Source ids skipped as missing or foreign never reach it, so requiring
  // them would leave recovery unable to ever certify.
  const requiredIds = new Set(rekeyedItems.map((item) => item.id));
  if (isRecoveryAttempt && (await isCertifiedProjectIndexContaining(newProjectPath, requiredIds))) {
    return removeMigratedSourceIndex(oldProjectPath);
  }

  // The marker makes writeCursorProjectIndex rebuild the destination from a full
  // scan. Keep it until the rebuilt cursor index proves every source id is present.
  if (isRecoveryAttempt) {
    try {
      await markProjectReconcile(newProjectPath);
    } catch (error) {
      log("warn", "reviews_rekeyed_destination_index_mark_reconcile_failed", { error });
      return false;
    }
  }

  // The source index is the durable retry set for already-rekeyed review files. A later
  // destination listing/rekey retry must prove the merged existing + moved set before
  // source cleanup is allowed.
  if (!(await publishRekeyedToDestination(newProjectPath, rekeyedItems, isRecoveryAttempt))) {
    return false;
  }

  if (isRecoveryAttempt) {
    const isComplete = await isCanonicalCursorIndexContaining(newProjectPath, requiredIds);
    if (!isComplete) return false;
    await clearReconcileMarker(newProjectPath);
  }
  return removeMigratedSourceIndex(oldProjectPath);
}

/**
 * Merges the reviews a rekey pass moved into the destination index. Returns false when the
 * destination index could not be updated, in which case the caller must retain the source
 * index. `reconcileMarked` says whether the destination already carries a reconcile marker,
 * so a failed invalidation does not silently leave a stale index hiding durable reviews.
 */
async function publishRekeyedToDestination(
  newProjectPath: string,
  rekeyedItems: ReviewMetadata[],
  reconcileMarked: boolean,
): Promise<boolean> {
  if (rekeyedItems.length === 0) return true;

  try {
    await writeCursorProjectIndex(newProjectPath, rekeyedItems, scanReviewsForCertification);
    return true;
  } catch (error) {
    log("warn", "reviews_rekeyed_destination_index_write_failed", { error });
    const invalidated = await invalidateProjectIndex(newProjectPath)
      .then(() => true)
      .catch((invalidationError) => {
        log("warn", "reviews_rekeyed_destination_index_invalidate_failed", {
          error: invalidationError,
        });
        return false;
      });
    if (!invalidated && !reconcileMarked) {
      await markProjectReconcile(newProjectPath).catch((markerError) =>
        log("warn", "reviews_rekeyed_destination_index_mark_reconcile_failed", {
          error: markerError,
        }),
      );
    }
    return false;
  }
}

async function isCanonicalCursorIndexContaining(
  projectPath: string,
  requiredIds: ReadonlySet<string>,
): Promise<boolean> {
  const [indexResult, isCursorOrdered] = await Promise.all([
    readProjectIndexData(projectPath),
    hasCursorIndexMarker(projectPath),
  ]);
  const { entries, isCanonical } =
    indexResult.kind === "valid" ? indexResult.data : emptyProjectIndexData();
  if (!isCursorOrdered || !entries || !isCanonical) return false;
  const indexedIds = new Set(entries.map((entry) => entry.id));
  return [...requiredIds].every((id) => indexedIds.has(id));
}

async function isCertifiedProjectIndexContaining(
  projectPath: string,
  requiredIds: ReadonlySet<string>,
): Promise<boolean> {
  const [needsReconcile, containsRequiredIds] = await Promise.all([
    hasReconcileMarker(projectPath),
    isCanonicalCursorIndexContaining(projectPath, requiredIds),
  ]);
  return !needsReconcile && containsRequiredIds;
}

async function removeMigratedSourceIndex(oldProjectPath: string): Promise<boolean> {
  try {
    await withProjectIndexLock(oldProjectPath, async () => {
      await clearCursorIndexMarker(oldProjectPath);
      try {
        await unlink(projectIndexPath(oldProjectPath));
      } finally {
        invalidateCachedProjectIndex(oldProjectPath);
      }
    });
    return true;
  } catch (error) {
    if (!isNodeError(error, "ENOENT")) {
      log("warn", "reviews_stale_index_removal_failed", { error });
      return false;
    }
    return true;
  }
}
