import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { getErrorMessage } from "@diffgazer/core/errors";
import { ok, type Result } from "@diffgazer/core/result";
import { calculateSeverityCounts } from "@diffgazer/core/schemas/presentation";
import {
  type DrilldownResult,
  type ReviewGitContext,
  type ReviewMetadata,
  ReviewMetadataSchema,
  type SavedReview,
  SavedReviewSchema,
} from "@diffgazer/core/schemas/review";
import { atomicWriteFile, isNodeError } from "../../../shared/lib/fs.js";
import { log } from "../../../shared/lib/log.js";
import { getGlobalDiffgazerDir } from "../../../shared/lib/paths.js";
import { lenientReadSavedReview } from "./lenient-read.js";
import { createCollection } from "./persistence.js";
import { withReviewLock } from "./review-lock.js";
import type { DateFieldsOf, SaveReviewOptions, StoreError } from "./types.js";

function filterByProjectAndSort<T extends { projectPath: string }>(
  items: T[],
  projectPath: string | undefined,
  dateField: DateFieldsOf<T>,
): T[] {
  const filtered = projectPath ? items.filter((item) => item.projectPath === projectPath) : items;
  return filtered.sort(
    (a, b) =>
      new Date(b[dateField] as string).getTime() - new Date(a[dateField] as string).getTime(),
  );
}

// Legacy on-disk directory name kept as "triage-reviews" to avoid data migration
const REVIEWS_DIR = join(getGlobalDiffgazerDir(), "triage-reviews");
const PROJECT_INDEX_DIR = join(REVIEWS_DIR, ".index");
const getReviewFile = (reviewId: string): string => join(REVIEWS_DIR, `${reviewId}.json`);

function projectIndexPath(projectPath: string): string {
  const hash = createHash("sha256").update(projectPath).digest("hex").slice(0, 16);
  return join(PROJECT_INDEX_DIR, `${hash}.json`);
}

async function readProjectIndex(projectPath: string): Promise<string[]> {
  try {
    const raw = await readFile(projectIndexPath(projectPath), "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

async function writeProjectIndex(projectPath: string, ids: string[]): Promise<void> {
  await mkdir(PROJECT_INDEX_DIR, { recursive: true, mode: 0o700 });
  await atomicWriteFile(projectIndexPath(projectPath), JSON.stringify(ids));
}

async function addToProjectIndex(projectPath: string, reviewId: string): Promise<void> {
  const ids = await readProjectIndex(projectPath);
  if (!ids.includes(reviewId)) {
    ids.push(reviewId);
    await writeProjectIndex(projectPath, ids);
  }
}

async function removeFromProjectIndex(projectPath: string, reviewId: string): Promise<void> {
  const ids = await readProjectIndex(projectPath);
  const filtered = ids.filter((id) => id !== reviewId);
  if (filtered.length !== ids.length) {
    await writeProjectIndex(projectPath, filtered);
  }
}

const reviewStore = createCollection<SavedReview, ReviewMetadata>({
  name: "review",
  dir: REVIEWS_DIR,
  filePath: getReviewFile,
  schema: SavedReviewSchema,
  metadataSchema: ReviewMetadataSchema,
  getMetadata: (review) => review.metadata,
  getId: (review) => review.metadata.id,
  // Older immutable reviews can hold values the strict write-side schema rejects;
  // salvage them on read so GET opens and DELETE removes them (F-446).
  lenientRead: lenientReadSavedReview,
});

function migrateReview(review: SavedReview): SavedReview | null {
  const { metadata } = review;
  const { issues } = review.result;

  if (issues.length === 0) return null;

  const totalCounted =
    metadata.blockerCount +
    metadata.highCount +
    metadata.mediumCount +
    metadata.lowCount +
    metadata.nitCount;

  if (totalCounted > 0 || metadata.issueCount === 0) return null;

  const counts = calculateSeverityCounts(issues);
  return {
    ...review,
    metadata: {
      ...metadata,
      blockerCount: counts.blocker,
      highCount: counts.high,
      mediumCount: counts.medium,
      lowCount: counts.low,
      nitCount: counts.nit,
    },
  };
}

// Persist a legacy-migration result under the review's lock, re-reading the
// current file inside the lock so the background write can never overwrite a
// just-saved drilldown or resurrect a review that was deleted in the meantime.
function persistMigrationLocked(reviewId: string): Promise<void> {
  return withReviewLock(reviewId, async () => {
    const current = await reviewStore.read(reviewId);
    if (!current.ok) return;
    const migrated = migrateReview(current.value);
    if (!migrated) return;
    await reviewStore.write(migrated);
  }).catch((e) => log("warn", "reviews_migration_write_failed", { error: e }));
}

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

  const metadata: ReviewMetadata = {
    id: options.reviewId ?? randomUUID(),
    projectPath: options.projectPath,
    createdAt: now,
    mode: options.mode,
    branch: options.branch,
    profile: options.profile ?? null,
    lenses: options.lenses,
    issueCount: options.result.issues.length,
    blockerCount: severityCounts.blocker,
    highCount: severityCounts.high,
    mediumCount: severityCounts.medium,
    lowCount: severityCounts.low,
    nitCount: severityCounts.nit,
    fileCount: options.diff.totalStats.filesChanged,
    durationMs: options.durationMs,
  };

  const savedReview: SavedReview = {
    metadata,
    result: options.result,
    diff: options.diff,
    gitContext,
    drilldowns: options.drilldowns ?? [],
    ...(options.lensStats ? { lensStats: options.lensStats } : {}),
    ...(options.droppedDuplicates !== undefined
      ? { droppedDuplicates: options.droppedDuplicates }
      : {}),
    ...(options.droppedBelowThreshold !== undefined
      ? { droppedBelowThreshold: options.droppedBelowThreshold }
      : {}),
    ...(options.minSeverity !== undefined ? { minSeverity: options.minSeverity } : {}),
  };

  const writeResult = await reviewStore.write(savedReview);
  if (!writeResult.ok) return writeResult;
  // Best-effort: the review file is durably written, so an index write failure
  // must not fail the save — the index self-heals via listReviews' rebuild.
  addToProjectIndex(options.projectPath, metadata.id).catch((e) =>
    log("warn", "reviews_index_add_failed", { error: e }),
  );
  return ok(metadata);
}

export async function addDrilldownToReview(
  reviewId: string,
  drilldown: DrilldownResult,
): Promise<Result<void, StoreError>> {
  const readResult = await reviewStore.read(reviewId);
  if (!readResult.ok) return readResult;

  const review = readResult.value;
  const existingIndex = review.drilldowns.findIndex((d) => d.issueId === drilldown.issueId);

  if (existingIndex >= 0) {
    review.drilldowns[existingIndex] = drilldown;
  } else {
    review.drilldowns.push(drilldown);
  }

  return reviewStore.write(review);
}

async function migrateMetadataList(items: ReviewMetadata[]): Promise<ReviewMetadata[]> {
  return Promise.all(
    items.map(async (metadata) => {
      const totalCounted =
        metadata.blockerCount +
        metadata.highCount +
        metadata.mediumCount +
        metadata.lowCount +
        metadata.nitCount;

      if (totalCounted === 0 && metadata.issueCount > 0) {
        const reviewResult = await reviewStore.read(metadata.id);
        if (!reviewResult.ok) return metadata;

        const migrated = migrateReview(reviewResult.value);
        if (migrated) {
          // Persist in background through the review lock (fire and forget).
          void persistMigrationLocked(metadata.id);
          return migrated.metadata;
        }
      }

      return metadata;
    }),
  );
}

type IndexListing =
  | { kind: "served"; items: ReviewMetadata[]; warnings: string[] }
  | { kind: "rebuild" };

// Serve a project listing from the index's per-review reads. Drops entries whose
// review file is gone (rewriting the index) and falls back to a full scan only on
// an index read-error so the two paths never both run for one call.
async function listFromIndex(projectPath: string, indexedIds: string[]): Promise<IndexListing> {
  const items: ReviewMetadata[] = [];
  const liveIds: string[] = [];

  for (const id of indexedIds) {
    const readResult = await reviewStore.read(id);
    if (!readResult.ok) {
      // Missing file: drop it from the index and keep serving.
      if (readResult.error.code === "NOT_FOUND") continue;
      // Any other read failure means the index can't be trusted; rebuild via scan.
      return { kind: "rebuild" };
    }
    if (readResult.value.metadata.projectPath !== projectPath) continue;
    items.push(readResult.value.metadata);
    liveIds.push(id);
  }

  const warnings: string[] = [];
  if (liveIds.length !== indexedIds.length) {
    try {
      await writeProjectIndex(projectPath, liveIds);
    } catch (error) {
      warnings.push(`[reviews] Failed to rewrite project index: ${getErrorMessage(error)}`);
    }
  }

  return {
    kind: "served",
    items: filterByProjectAndSort(items, undefined, "createdAt"),
    warnings,
  };
}

export async function listReviews(
  projectPath?: string,
): Promise<Result<{ items: ReviewMetadata[]; warnings: string[] }, StoreError>> {
  // Index path: when a project index exists and reads cleanly, serve from it
  // without touching the full directory scan.
  if (projectPath) {
    const indexedIds = await readProjectIndex(projectPath);
    if (indexedIds.length > 0) {
      const listing = await listFromIndex(projectPath, indexedIds);
      if (listing.kind === "served") {
        const migratedItems = await migrateMetadataList(listing.items);
        return ok({ items: migratedItems, warnings: listing.warnings });
      }
    }
  }

  // Full-scan path: global listing, index miss, or index read-error. Rebuild the
  // project index from the scan.
  const result = await reviewStore.list();
  if (!result.ok) return result;

  const items = filterByProjectAndSort(result.value.items, projectPath, "createdAt");

  const migratedItems = await migrateMetadataList(items);
  const warnings = [...result.value.warnings];

  if (projectPath && items.length > 0) {
    try {
      await writeProjectIndex(
        projectPath,
        items.map((item) => item.id),
      );
    } catch (error) {
      warnings.push(`[reviews] Failed to build project index: ${getErrorMessage(error)}`);
    }
  }

  return ok({ items: migratedItems, warnings });
}

export async function getReview(reviewId: string): Promise<Result<SavedReview, StoreError>> {
  const result = await reviewStore.read(reviewId);
  if (!result.ok) return result;

  const review = result.value;
  const migrated = migrateReview(review);
  if (migrated) {
    // Persist migrated data in background through the review lock (fire and forget).
    void persistMigrationLocked(review.metadata.id);
    return ok(migrated);
  }

  return ok(review);
}

export async function deleteReview(
  reviewId: string,
  projectPath?: string,
): Promise<Result<{ existed: boolean }, StoreError>> {
  if (projectPath) {
    removeFromProjectIndex(projectPath, reviewId).catch((e) =>
      log("warn", "reviews_index_removal_failed", { error: e }),
    );
  }
  // Serialize the unlink through the review lock so a background legacy-migration
  // write enqueued just before this delete cannot rename the file back into place
  // after it is removed.
  return withReviewLock(reviewId, () => reviewStore.remove(reviewId));
}

// Move a project's stored review history to a new project path (used when a
// repository directory is moved/renamed). Rewrites each matching review's
// metadata.projectPath under its lock and migrates the sha256(projectPath) index
// file to the new key.
export async function rekeyProjectReviews(
  oldProjectPath: string,
  newProjectPath: string,
): Promise<void> {
  if (oldProjectPath === newProjectPath) return;

  const oldIds = await readProjectIndex(oldProjectPath);
  const ids = oldIds.length > 0 ? oldIds : await scanProjectReviewIds(oldProjectPath);

  const rekeyed: string[] = [];
  for (const id of ids) {
    const moved = await withReviewLock(id, async () => {
      const current = await reviewStore.read(id);
      if (!current.ok) return false;
      if (current.value.metadata.projectPath !== oldProjectPath) return false;
      const next: SavedReview = {
        ...current.value,
        metadata: { ...current.value.metadata, projectPath: newProjectPath },
      };
      const writeResult = await reviewStore.write(next);
      return writeResult.ok;
    });
    if (moved) rekeyed.push(id);
  }

  await migrateProjectIndexFile(oldProjectPath, newProjectPath, rekeyed);
}

async function scanProjectReviewIds(projectPath: string): Promise<string[]> {
  const result = await reviewStore.list();
  if (!result.ok) return [];
  return result.value.items
    .filter((metadata) => metadata.projectPath === projectPath)
    .map((metadata) => metadata.id);
}

async function migrateProjectIndexFile(
  oldProjectPath: string,
  newProjectPath: string,
  rekeyedIds: string[],
): Promise<void> {
  if (rekeyedIds.length > 0) {
    const existing = await readProjectIndex(newProjectPath);
    const merged = Array.from(new Set([...existing, ...rekeyedIds]));
    try {
      await writeProjectIndex(newProjectPath, merged);
    } catch (e) {
      log("warn", "reviews_rekeyed_index_write_failed", { error: e });
    }
  }
  try {
    await unlink(projectIndexPath(oldProjectPath));
  } catch (error) {
    if (!isNodeError(error, "ENOENT")) {
      log("warn", "reviews_stale_index_removal_failed", { error });
    }
  }
}
