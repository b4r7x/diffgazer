import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { ok, type Result } from "@diffgazer/core/result";
import { UuidSchema } from "@diffgazer/core/schemas/fields";
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
import {
  coerceMetadataVocab,
  lenientReadSavedReview,
  normalizeSavedReviewLineFields,
} from "./lenient-read.js";
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

function projectHash(projectPath: string): string {
  return createHash("sha256").update(projectPath).digest("hex").slice(0, 16);
}

function projectIndexPath(projectPath: string): string {
  return join(PROJECT_INDEX_DIR, `${projectHash(projectPath)}.json`);
}

// Staleness signal gating the cross-project orphan reconcile: dropped when a saved
// review could neither be indexed nor cleared by invalidation. Absent it, listings
// serve straight from the per-project index (F-097).
function projectReconcileMarkerPath(projectPath: string): string {
  return join(PROJECT_INDEX_DIR, `${projectHash(projectPath)}.reconcile`);
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

const projectIndexLocks = new Map<string, Promise<unknown>>();

function withProjectIndexLock<T>(projectPath: string, fn: () => Promise<T>): Promise<T> {
  const key = projectIndexPath(projectPath);
  const prev = projectIndexLocks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  projectIndexLocks.set(key, next);
  next.then(
    () => {
      if (projectIndexLocks.get(key) === next) projectIndexLocks.delete(key);
    },
    () => {
      if (projectIndexLocks.get(key) === next) projectIndexLocks.delete(key);
    },
  );
  return next;
}

function writeProjectIndexLocked(projectPath: string, ids: string[]): Promise<void> {
  return withProjectIndexLock(projectPath, () => writeProjectIndex(projectPath, ids));
}

async function addToProjectIndex(projectPath: string, reviewId: string): Promise<void> {
  await withProjectIndexLock(projectPath, async () => {
    const ids = await readProjectIndex(projectPath);
    if (!ids.includes(reviewId)) {
      ids.push(reviewId);
      await writeProjectIndex(projectPath, ids);
    }
  });
}

async function removeFromProjectIndex(projectPath: string, reviewId: string): Promise<void> {
  await withProjectIndexLock(projectPath, async () => {
    const ids = await readProjectIndex(projectPath);
    const filtered = ids.filter((id) => id !== reviewId);
    if (filtered.length !== ids.length) {
      await writeProjectIndex(projectPath, filtered);
    }
  });
}

// Drop the index file so the next listing rebuilds from a full scan. A stale-but-
// readable index would otherwise be served as authoritative and hide a durable save.
async function invalidateProjectIndex(projectPath: string): Promise<void> {
  await withProjectIndexLock(projectPath, async () => {
    try {
      await unlink(projectIndexPath(projectPath));
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) throw error;
    }
  });
}

async function markProjectReconcile(projectPath: string): Promise<void> {
  await mkdir(PROJECT_INDEX_DIR, { recursive: true, mode: 0o700 });
  await atomicWriteFile(projectReconcileMarkerPath(projectPath), "");
}

async function hasReconcileMarker(projectPath: string): Promise<boolean> {
  try {
    await stat(projectReconcileMarkerPath(projectPath));
    return true;
  } catch {
    return false;
  }
}

async function clearReconcileMarker(projectPath: string): Promise<void> {
  try {
    await unlink(projectReconcileMarkerPath(projectPath));
  } catch (error) {
    if (!isNodeError(error, "ENOENT")) throw error;
  }
}

const isValidUuid = (id: string): boolean => UuidSchema.safeParse(id).success;

// Review ids with a JSON file on disk, gated through UuidSchema to match the
// full-scan list() (so stray json is never read). An unreadable dir yields [].
async function readReviewDirIds(): Promise<string[]> {
  try {
    const files = await readdir(REVIEWS_DIR);
    return files
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.slice(0, -".json".length))
      .filter(isValidUuid);
  } catch {
    return [];
  }
}

// Union of every review id across all project index files. Reconciliation treats
// only ids absent from this set as orphans.
async function readAllIndexedIds(): Promise<Set<string>> {
  const indexed = new Set<string>();
  let files: string[];
  try {
    files = await readdir(PROJECT_INDEX_DIR);
  } catch {
    return indexed;
  }
  await Promise.all(
    files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        try {
          const parsed = JSON.parse(await readFile(join(PROJECT_INDEX_DIR, f), "utf-8"));
          if (Array.isArray(parsed)) {
            for (const id of parsed) if (typeof id === "string") indexed.add(id);
          }
        } catch {
          // Unreadable index just leaves its reviews eligible for orphan reconcile.
        }
      }),
  );
  return indexed;
}

const reviewStore = createCollection<SavedReview, ReviewMetadata>({
  name: "review",
  dir: REVIEWS_DIR,
  filePath: getReviewFile,
  schema: SavedReviewSchema,
  metadataSchema: ReviewMetadataSchema,
  getMetadata: (review) => review.metadata,
  getId: (review) => review.metadata.id,
  // Salvage older immutable reviews the strict write-side schema rejects, so GET
  // opens and DELETE removes them (F-446).
  lenientRead: lenientReadSavedReview,
  coerceMetadata: coerceMetadataVocab,
  transformRead: normalizeSavedReviewLineFields,
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

// Re-read inside the lock so this background write can never overwrite a just-saved
// drilldown or resurrect a review deleted in the meantime.
function persistMigrationLocked(reviewId: string): Promise<void> {
  return withReviewLock(reviewId, async () => {
    const current = await reviewStore.readDetailed(reviewId);
    if (!current.ok) return;
    if (current.value.salvaged) return;
    const migrated = migrateReview(current.value.item);
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
  // The review file is the durable record; the index is a derived discovery cache.
  // On append failure, drop the now-stale index so the next listing rebuilds it from
  // a full scan; the durable save still succeeds.
  try {
    await addToProjectIndex(options.projectPath, metadata.id);
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

// Surface reviews on disk but absent from every index (save-time append and its
// invalidation both failed) so index-served history no longer depends on a successful
// save-time index write (F-097). A corrupt orphan becomes a listing warning, mirroring
// the full-scan list() path, rather than being dropped silently.
async function reconcileOrphans(
  projectPath: string,
): Promise<{ matched: ReviewMetadata[]; warnings: string[] }> {
  const [dirIds, indexedEverywhere] = await Promise.all([readReviewDirIds(), readAllIndexedIds()]);
  const orphanIds = dirIds.filter((id) => !indexedEverywhere.has(id));
  if (orphanIds.length === 0) return { matched: [], warnings: [] };

  const results = await Promise.all(
    orphanIds.map(async (id) => ({ id, result: await reviewStore.readMetadata(id) })),
  );
  const matched: ReviewMetadata[] = [];
  const warnings: string[] = [];
  for (const { id, result } of results) {
    if (!result.ok) {
      warnings.push(`[reviews] Failed to read ${id}: ${result.error.message}`);
      continue;
    }
    if (result.value.projectPath !== projectPath) continue;
    matched.push(result.value);
  }
  return { matched, warnings };
}

// Serve a listing from the index's per-review reads. Drops entries whose review file
// is gone, merges orphans only when the reconcile marker flags a prior stale save,
// rewrites the index when either changes it, and falls back to a full scan only on an
// index read-error (so the two paths never both run for one call).
async function listFromIndex(projectPath: string, indexedIds: string[]): Promise<IndexListing> {
  const items: ReviewMetadata[] = [];
  const indexIds: string[] = [];

  const results = await Promise.all(
    indexedIds.map(async (id) => ({ id, result: await reviewStore.readMetadata(id) })),
  );
  for (const { id, result: readResult } of results) {
    if (!readResult.ok) {
      // Missing file: drop from the index and keep serving.
      if (readResult.error.code === "NOT_FOUND") continue;
      // Any other read failure means the index can't be trusted; rebuild via scan.
      return { kind: "rebuild" };
    }
    if (readResult.value.projectPath !== projectPath) continue;
    items.push(readResult.value);
    indexIds.push(id);
  }

  // A healthy per-project index is authoritative: reconcile orphans against every
  // index only when the marker flags a prior stale save, so normal listings never pay
  // the O(projects) cross-project scan.
  const needsReconcile = await hasReconcileMarker(projectPath);
  const reconciled: { matched: ReviewMetadata[]; warnings: string[] } = needsReconcile
    ? await reconcileOrphans(projectPath)
    : { matched: [], warnings: [] };
  for (const metadata of reconciled.matched) {
    items.push(metadata);
    indexIds.push(metadata.id);
  }

  const warnings: string[] = [...reconciled.warnings];
  let rewriteFailed = false;
  if (indexIds.length !== indexedIds.length || reconciled.matched.length > 0) {
    try {
      await writeProjectIndexLocked(projectPath, indexIds);
    } catch (error) {
      log("warn", "reviews_index_rewrite_failed", { error });
      warnings.push("[reviews] Failed to rewrite project index");
      rewriteFailed = true;
    }
  }
  // Reconcile merged anything durably saved but missing here; drop the marker to
  // restore the fast path. Keep it on a rewrite failure so the next listing retries.
  if (needsReconcile && !rewriteFailed) {
    await clearReconcileMarker(projectPath).catch((error) =>
      log("warn", "reviews_index_clear_reconcile_failed", { error }),
    );
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

  // Full-scan path (global listing, index miss, or read-error); rebuild the index.
  const result = await reviewStore.list();
  if (!result.ok) return result;

  const items = filterByProjectAndSort(result.value.items, projectPath, "createdAt");

  const migratedItems = await migrateMetadataList(items);
  const warnings = [...result.value.warnings];

  if (projectPath && items.length > 0) {
    try {
      await writeProjectIndexLocked(
        projectPath,
        items.map((item) => item.id),
      );
    } catch (error) {
      log("warn", "reviews_index_build_failed", { error });
      warnings.push("[reviews] Failed to build project index");
    }
  }

  return ok({ items: migratedItems, warnings });
}

export async function getReview(reviewId: string): Promise<Result<SavedReview, StoreError>> {
  const result = await reviewStore.readDetailed(reviewId);
  if (!result.ok) return result;

  const review = result.value.item;
  const migrated = migrateReview(review);
  if (migrated) {
    if (!result.value.salvaged) {
      void persistMigrationLocked(review.metadata.id);
    }
    return ok(migrated);
  }

  return ok(review);
}

export async function deleteReview(
  reviewId: string,
  projectPath?: string,
): Promise<Result<{ existed: boolean }, StoreError>> {
  // Serialize the unlink through the review lock so a background migration write
  // enqueued just before this delete cannot write the file back after removal.
  const result = await withReviewLock(reviewId, () => reviewStore.remove(reviewId));
  if (result.ok && projectPath) {
    removeFromProjectIndex(projectPath, reviewId).catch((e) =>
      log("warn", "reviews_index_removal_failed", { error: e }),
    );
  }
  return result;
}

// Move a project's stored review history to a new path (repo dir moved/renamed):
// rewrite each matching review's metadata.projectPath under its lock and migrate the
// sha256(projectPath) index file to the new key.
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
      const current = await reviewStore.readDetailed(id);
      if (!current.ok) return false;
      const review = current.value.item;
      if (review.metadata.projectPath !== oldProjectPath) return false;
      const next: SavedReview = {
        ...review,
        metadata: { ...review.metadata, projectPath: newProjectPath },
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
    try {
      await withProjectIndexLock(newProjectPath, async () => {
        const existing = await readProjectIndex(newProjectPath);
        const merged = Array.from(new Set([...existing, ...rekeyedIds]));
        await writeProjectIndex(newProjectPath, merged);
      });
    } catch (e) {
      log("warn", "reviews_rekeyed_index_write_failed", { error: e });
    }
  }
  try {
    await withProjectIndexLock(oldProjectPath, () => unlink(projectIndexPath(oldProjectPath)));
  } catch (error) {
    if (!isNodeError(error, "ENOENT")) {
      log("warn", "reviews_stale_index_removal_failed", { error });
    }
  }
}
