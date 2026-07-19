import { createHash, randomUUID } from "node:crypto";
import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, stat, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import { UuidSchema } from "@diffgazer/core/schemas/fields";
import { calculateSeverityCounts } from "@diffgazer/core/schemas/presentation";
import {
  type ReviewGitContext,
  type ReviewListWarning,
  type ReviewMetadata,
  ReviewMetadataSchema,
  type SavedReview,
  SavedReviewSchema,
} from "@diffgazer/core/schemas/review";
import { atomicWriteFile, isNodeError } from "../../../shared/lib/fs.js";
import { log } from "../../../shared/lib/log.js";
import { getGlobalDiffgazerDir } from "../../../shared/lib/paths.js";
import { createKeyedLock } from "./keyed-lock.js";
import {
  coerceMetadataVocab,
  lenientReadSavedReview,
  normalizeSavedReviewLineFields,
  type ReviewSalvageDiagnostics,
} from "./lenient-read.js";
import { createCollection } from "./persistence.js";
import {
  decodeReviewCursor,
  encodeReviewCursor,
  type ReviewCursorBoundary,
} from "./review-cursor.js";
import { withReviewLock } from "./review-lock.js";
import type { DateFieldsOf, SaveReviewOptions, StoreError, StoreErrorCode } from "./types.js";

function compareReviewOrder(a: ReviewCursorBoundary, b: ReviewCursorBoundary): number {
  const dateOrder = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  return dateOrder || b.id.localeCompare(a.id);
}

function filterByProjectAndSort<T extends { id: string; projectPath: string }>(
  items: T[],
  projectPath: string | undefined,
  dateField: DateFieldsOf<T>,
): T[] {
  const filtered = projectPath ? items.filter((item) => item.projectPath === projectPath) : items;
  return filtered.sort((a, b) =>
    compareReviewOrder(
      { id: a.id, createdAt: a[dateField] as string },
      { id: b.id, createdAt: b[dateField] as string },
    ),
  );
}

// Legacy on-disk directory name kept as "triage-reviews" to avoid data migration
const REVIEWS_DIR = join(getGlobalDiffgazerDir(), "triage-reviews");
const PROJECT_INDEX_DIR = join(REVIEWS_DIR, ".index");
const CURSOR_INDEX_MARKER = "createdAt+id-v1\n";
const MAX_CACHED_PROJECT_INDEXES = 16;
const MAX_CONCURRENT_REVIEW_READS = 8;
const getReviewFile = (reviewId: string): string => {
  const parsedId = UuidSchema.safeParse(reviewId);
  if (!parsedId.success) throw new Error("Invalid review id");

  const filePath = resolve(REVIEWS_DIR, `${parsedId.data}.json`);
  const relativePath = relative(REVIEWS_DIR, filePath);
  if (relativePath === ".." || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) {
    throw new Error("Review path escapes the collection directory");
  }
  return filePath;
};

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

function projectCursorIndexMarkerPath(projectPath: string): string {
  return join(PROJECT_INDEX_DIR, `${projectHash(projectPath)}.cursor-v1`);
}

type ProjectIndexEntry = ReviewCursorBoundary;

interface ProjectIndexData {
  entries: ProjectIndexEntry[] | null;
  ids: string[];
  isCanonical: boolean;
  needsRewrite: boolean;
}

type ProjectIndexReadResult =
  | { kind: "missing" }
  | { kind: "valid"; data: ProjectIndexData }
  | {
      kind: "corrupt";
      reason: "parse-error" | "invalid-shape" | "read-error" | "unstable-read";
    };

interface CachedProjectIndex {
  identity: string;
  data: ProjectIndexData;
}

const projectIndexCache = new Map<string, CachedProjectIndex>();

function emptyProjectIndexData(): ProjectIndexData {
  return { entries: null, ids: [], isCanonical: false, needsRewrite: false };
}

function isProjectIndexEntry(value: unknown): value is ProjectIndexEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ProjectIndexEntry>;
  const timestamp = typeof candidate.createdAt === "string" ? Date.parse(candidate.createdAt) : NaN;
  return (
    typeof candidate.createdAt === "string" &&
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString() === candidate.createdAt &&
    typeof candidate.id === "string" &&
    isValidUuid(candidate.id)
  );
}

function isCanonicalProjectIndex(entries: ProjectIndexEntry[]): boolean {
  const ids = new Set<string>();
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    if (!entry || ids.has(entry.id)) return false;
    ids.add(entry.id);
    const previous = entries[index - 1];
    if (previous && compareReviewOrder(previous, entry) > 0) return false;
  }
  return true;
}

function parseProjectIndex(raw: string): ProjectIndexData | null {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return null;
  if (parsed.every(isProjectIndexEntry)) {
    const seenIds = new Set<string>();
    const entries = parsed.filter((entry) => {
      if (seenIds.has(entry.id)) return false;
      seenIds.add(entry.id);
      return true;
    });
    const needsRewrite = entries.length !== parsed.length;
    return {
      entries,
      ids: entries.map((entry) => entry.id),
      isCanonical: !needsRewrite && isCanonicalProjectIndex(entries),
      needsRewrite,
    };
  }
  if (
    !parsed.every(
      (value) =>
        (typeof value === "string" && UuidSchema.safeParse(value).success) ||
        isProjectIndexEntry(value),
    )
  ) {
    return null;
  }
  const parsedIds = parsed.map((value) => (typeof value === "string" ? value : value.id));
  const ids = [...new Set(parsedIds)];
  return { entries: null, ids, isCanonical: false, needsRewrite: ids.length !== parsedIds.length };
}

async function getProjectIndexIdentity(indexPath: string): Promise<string> {
  const metadata = await stat(indexPath, { bigint: true });
  return [metadata.dev, metadata.ino, metadata.size, metadata.mtimeNs, metadata.ctimeNs].join(":");
}

function getCachedProjectIndex(indexPath: string, identity: string): ProjectIndexData | null {
  const cached = projectIndexCache.get(indexPath);
  if (!cached || cached.identity !== identity) return null;
  projectIndexCache.delete(indexPath);
  projectIndexCache.set(indexPath, cached);
  return cached.data;
}

function cacheProjectIndex(indexPath: string, identity: string, data: ProjectIndexData): void {
  projectIndexCache.delete(indexPath);
  projectIndexCache.set(indexPath, { identity, data });
  while (projectIndexCache.size > MAX_CACHED_PROJECT_INDEXES) {
    const oldestKey = projectIndexCache.keys().next().value;
    if (oldestKey === undefined) break;
    projectIndexCache.delete(oldestKey);
  }
}

function invalidateCachedProjectIndex(projectPath: string): void {
  projectIndexCache.delete(projectIndexPath(projectPath));
}

async function readProjectIndexData(projectPath: string): Promise<ProjectIndexReadResult> {
  const indexPath = projectIndexPath(projectPath);
  try {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const identityBeforeRead = await getProjectIndexIdentity(indexPath);
      const cached = getCachedProjectIndex(indexPath, identityBeforeRead);
      if (cached) return { kind: "valid", data: cached };

      const raw = await readFile(indexPath, "utf-8");
      const identityAfterRead = await getProjectIndexIdentity(indexPath);
      if (identityBeforeRead !== identityAfterRead) continue;

      let data: ProjectIndexData | null;
      try {
        data = parseProjectIndex(raw);
      } catch {
        return { kind: "corrupt", reason: "parse-error" };
      }
      if (data === null) return { kind: "corrupt", reason: "invalid-shape" };
      cacheProjectIndex(indexPath, identityAfterRead, data);
      return { kind: "valid", data };
    }

    return { kind: "corrupt", reason: "unstable-read" };
  } catch (error) {
    return isNodeError(error, "ENOENT")
      ? { kind: "missing" }
      : { kind: "corrupt", reason: "read-error" };
  }
}

async function writeProjectIndex(projectPath: string, entries: ProjectIndexEntry[]): Promise<void> {
  await mkdir(PROJECT_INDEX_DIR, { recursive: true, mode: 0o700 });
  const indexPath = projectIndexPath(projectPath);
  await atomicWriteFile(indexPath, JSON.stringify(entries));
  try {
    const identity = await getProjectIndexIdentity(indexPath);
    cacheProjectIndex(indexPath, identity, {
      entries,
      ids: entries.map((entry) => entry.id),
      isCanonical: true,
      needsRewrite: false,
    });
  } catch {
    invalidateCachedProjectIndex(projectPath);
  }
}

const projectIndexLocks = new Map<string, Promise<unknown>>();
const lockProjectIndex = createKeyedLock(projectIndexLocks);

function withProjectIndexLock<T>(projectPath: string, fn: () => Promise<T>): Promise<T> {
  return lockProjectIndex(projectIndexPath(projectPath), fn);
}

async function writeCursorProjectIndexLocked(
  projectPath: string,
  sortedItems: ReviewMetadata[],
  options: {
    completeSnapshot?: boolean;
    excludedIds?: ReadonlySet<string>;
  } = {},
): Promise<ProjectIndexEntry[]> {
  const excludedIds = options.excludedIds ?? new Set<string>();
  const [indexResult, hasMarker] = await Promise.all([
    readProjectIndexData(projectPath),
    hasCursorIndexMarker(projectPath),
  ]);
  const indexData = indexResult.kind === "valid" ? indexResult.data : emptyProjectIndexData();
  const { entries, isCanonical } = indexData;
  const hasCertifiedBase = hasMarker && entries !== null && isCanonical;

  let baseEntries: ProjectIndexEntry[] = [];
  if (!options.completeSnapshot) {
    if (hasCertifiedBase) {
      baseEntries = entries;
    } else {
      const scannedItems = await scanReviewsForCertification(projectPath);
      baseEntries = scannedItems.map(({ id, createdAt }) => ({
        id,
        createdAt: new Date(createdAt).toISOString(),
      }));
    }
  }

  const entriesById = new Map(
    baseEntries.filter((entry) => !excludedIds.has(entry.id)).map((entry) => [entry.id, entry]),
  );
  for (const item of sortedItems) {
    if (!excludedIds.has(item.id)) {
      entriesById.set(item.id, {
        id: item.id,
        createdAt: new Date(item.createdAt).toISOString(),
      });
    }
  }

  const canonicalEntries = [...entriesById.values()].sort(compareReviewOrder);
  await clearCursorIndexMarker(projectPath);
  await writeProjectIndex(projectPath, canonicalEntries);
  await markCursorIndex(projectPath);
  if (indexResult.kind === "corrupt") {
    log("warn", "reviews_index_recovered", { reason: indexResult.reason });
  }
  return canonicalEntries;
}

function writeCursorProjectIndex(
  projectPath: string,
  sortedItems: ReviewMetadata[],
  excludedIds: ReadonlySet<string> = new Set(),
): Promise<ProjectIndexEntry[]> {
  return withProjectIndexLock(projectPath, () =>
    writeCursorProjectIndexLocked(projectPath, sortedItems, { excludedIds }),
  );
}

async function addToProjectIndex(metadata: ReviewMetadata): Promise<void> {
  await writeCursorProjectIndex(metadata.projectPath, [metadata]);
}

async function removeInvalidProjectIndexEntries(
  projectPath: string,
  invalidIds: Set<string>,
): Promise<void> {
  await withProjectIndexLock(projectPath, async () => {
    const indexResult = await readProjectIndexData(projectPath);
    if (indexResult.kind !== "valid") {
      await clearCursorIndexMarker(projectPath);
      return;
    }
    const { entries, isCanonical } = indexResult.data;
    if (!entries || !isCanonical) {
      await clearCursorIndexMarker(projectPath);
      return;
    }
    const filtered = entries.filter((entry) => !invalidIds.has(entry.id));
    if (filtered.length === entries.length) return;
    await clearCursorIndexMarker(projectPath);
    await writeProjectIndex(projectPath, filtered);
    await markCursorIndex(projectPath);
  });
}

// Drop the index file so the next listing rebuilds from a full scan. A stale-but-
// readable index would otherwise be served as authoritative and hide a durable save.
async function invalidateProjectIndex(projectPath: string): Promise<void> {
  await withProjectIndexLock(projectPath, async () => {
    await clearCursorIndexMarker(projectPath);
    try {
      await unlink(projectIndexPath(projectPath));
    } catch (error) {
      if (!isNodeError(error, "ENOENT")) throw error;
    }
    invalidateCachedProjectIndex(projectPath);
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

async function hasCursorIndexMarker(projectPath: string): Promise<boolean> {
  try {
    return (
      (await readFile(projectCursorIndexMarkerPath(projectPath), "utf-8")) === CURSOR_INDEX_MARKER
    );
  } catch {
    return false;
  }
}

async function clearCursorIndexMarker(projectPath: string): Promise<void> {
  try {
    await unlink(projectCursorIndexMarkerPath(projectPath));
  } catch (error) {
    if (!isNodeError(error, "ENOENT")) throw error;
  }
}

async function markCursorIndex(projectPath: string): Promise<void> {
  await atomicWriteFile(projectCursorIndexMarkerPath(projectPath), CURSOR_INDEX_MARKER);
}

const isValidUuid = (id: string): boolean => UuidSchema.safeParse(id).success;
const createStoreError = createError<StoreErrorCode>;

const reviewStore = createCollection<SavedReview, ReviewMetadata, ReviewSalvageDiagnostics>({
  name: "review",
  dir: REVIEWS_DIR,
  filePath: getReviewFile,
  schema: SavedReviewSchema,
  metadataSchema: ReviewMetadataSchema,
  getMetadata: (review) => review.metadata,
  getId: (review) => review.metadata.id,
  // Salvage older immutable reviews the strict write-side schema rejects so they
  // remain readable through review and history views (F-446).
  lenientRead: lenientReadSavedReview,
  coerceMetadata: coerceMetadataVocab,
  transformRead: normalizeSavedReviewLineFields,
});

async function mapWithLimitedConcurrency<T, R>(
  items: readonly T[],
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += MAX_CONCURRENT_REVIEW_READS) {
    const batch = items.slice(start, start + MAX_CONCURRENT_REVIEW_READS);
    results.push(...(await Promise.all(batch.map(mapper))));
  }
  return results;
}

async function readReviewIds(): Promise<Result<string[], StoreError>> {
  let entries: Dirent[];
  try {
    entries = await readdir(REVIEWS_DIR, { withFileTypes: true });
  } catch (error) {
    if (isNodeError(error, "ENOENT")) return ok([]);

    const isPermissionError = isNodeError(error, "EACCES") || isNodeError(error, "EPERM");
    const code = isPermissionError ? "PERMISSION_ERROR" : "PARSE_ERROR";
    log("warn", "review_store_io_error", {
      code,
      path: REVIEWS_DIR,
      cause: getErrorMessage(error),
    });
    return err(
      createStoreError(
        code,
        isPermissionError
          ? "Permission denied reading review directory"
          : "Failed to read review directory",
      ),
    );
  }

  return ok(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => entry.name.slice(0, -".json".length))
      .filter(isValidUuid),
  );
}

interface ReviewMetadataRead {
  metadata: ReviewMetadata;
  diagnostics: ReviewSalvageDiagnostics | null;
}

function readReviewMetadata(ids: readonly string[]) {
  return mapWithLimitedConcurrency(ids, async (id) => {
    const result = await reviewStore.readDetailed(id);
    if (!result.ok) return { id, result };
    if (result.value.item.metadata.id !== id) {
      return {
        id,
        result: err<StoreError>(
          createStoreError("VALIDATION_ERROR", "Review id does not match its filename"),
        ),
      };
    }
    return {
      id,
      result: ok<ReviewMetadataRead>({
        metadata: result.value.item.metadata,
        diagnostics: result.value.diagnostics,
      }),
    };
  });
}

function salvageWarning(reviewId: string, droppedIssueCount: number): ReviewListWarning | null {
  if (droppedIssueCount === 0) return null;
  return { kind: "invalid_issues_dropped", reviewId, count: droppedIssueCount };
}

function appendSalvageWarning(
  warnings: ReviewListWarning[],
  metadata: ReviewMetadata,
  diagnostics: ReviewSalvageDiagnostics | null,
): void {
  const warning = diagnostics ? salvageWarning(metadata.id, diagnostics.droppedIssueCount) : null;
  if (warning) warnings.push(warning);
}

function countFailedLenses(lensStats: SavedReview["lensStats"]): number {
  return lensStats?.filter((lens) => lens.status === "failed").length ?? 0;
}

function migrateReview(review: SavedReview): SavedReview | null {
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

  if (!needsFailedLensCount && !needsSeverityCounts) return null;

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
  };
}

// Re-read inside the lock so this background write preserves a concurrent
// project-path rekey.
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
  const failedLensCount = countFailedLenses(options.lensStats);

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
    durationMs: options.durationMs,
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
  };

  const writeResult = await reviewStore.write(savedReview);
  if (!writeResult.ok) return writeResult;
  // The review file is the durable record; the index is a derived discovery cache.
  // On append failure, drop the now-stale index so the next listing rebuilds it from
  // a full scan; the durable save still succeeds.
  try {
    await addToProjectIndex(metadata);
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

async function migrateMetadataList(items: ReviewMetadata[]): Promise<ReviewMetadata[]> {
  return mapWithLimitedConcurrency(items, async (metadata) => {
    const totalCounted =
      metadata.blockerCount +
      metadata.highCount +
      metadata.mediumCount +
      metadata.lowCount +
      metadata.nitCount;

    if (metadata.failedLensCount === undefined || (totalCounted === 0 && metadata.issueCount > 0)) {
      const reviewResult = await reviewStore.read(metadata.id);
      if (!reviewResult.ok) return metadata;

      const migrated = migrateReview(reviewResult.value);
      if (migrated) {
        void persistMigrationLocked(metadata.id);
        return migrated.metadata;
      }
    }

    return metadata;
  });
}

type IndexListing =
  | { kind: "served"; items: ReviewMetadata[]; warnings: ReviewListWarning[] }
  | { kind: "rebuild" };

// Non-paginated listings may read the whole index. A reconcile marker or unreadable
// entry switches to the serialized full-scan rebuild; missing entries are removed.
async function listFromIndex(
  projectPath: string,
  indexedIds: string[],
  needsRewrite: boolean,
): Promise<IndexListing> {
  if (await hasReconcileMarker(projectPath)) return { kind: "rebuild" };

  const items: ReviewMetadata[] = [];
  const invalidIds = new Set<string>();
  const warnings: ReviewListWarning[] = [];

  const results = await readReviewMetadata(indexedIds);
  for (const { id, result: readResult } of results) {
    if (!readResult.ok) {
      // Missing file: drop from the index and keep serving.
      if (readResult.error.code === "NOT_FOUND") {
        invalidIds.add(id);
        continue;
      }
      // Any other read failure means the index can't be trusted; rebuild via scan.
      return { kind: "rebuild" };
    }
    const { diagnostics, metadata } = readResult.value;
    if (metadata.projectPath !== projectPath) {
      invalidIds.add(id);
      continue;
    }
    appendSalvageWarning(warnings, metadata, diagnostics);
    items.push(metadata);
  }

  const sortedItems = filterByProjectAndSort(items, undefined, "createdAt");
  if (needsRewrite || items.length !== indexedIds.length) {
    try {
      await writeCursorProjectIndex(projectPath, sortedItems, invalidIds);
    } catch (error) {
      log("warn", "reviews_index_rewrite_failed", { error });
      warnings.push({ kind: "index_rewrite_failed" });
    }
  }

  return {
    kind: "served",
    items: sortedItems,
    warnings,
  };
}

export async function listReviews(
  projectPath?: string,
): Promise<Result<{ items: ReviewMetadata[]; warnings: ReviewListWarning[] }, StoreError>> {
  if (projectPath) {
    const indexResult = await readProjectIndexData(projectPath);
    if (indexResult.kind === "valid" && indexResult.data.ids.length > 0) {
      const listing = await listFromIndex(
        projectPath,
        indexResult.data.ids,
        indexResult.data.needsRewrite,
      );
      if (listing.kind === "served") {
        const migratedItems = await migrateMetadataList(listing.items);
        return ok({ items: migratedItems, warnings: listing.warnings });
      }
    }
    return listReviewsFromFullScan(projectPath, indexResult.kind === "corrupt");
  }

  return listReviewsFromFullScan();
}

async function scanReviews(
  projectPath?: string,
): Promise<
  Result<
    { items: ReviewMetadata[]; warnings: ReviewListWarning[]; isComplete: boolean },
    StoreError
  >
> {
  const idsResult = await readReviewIds();
  if (!idsResult.ok) return idsResult;

  const results = await readReviewMetadata(idsResult.value);
  const items: ReviewMetadata[] = [];
  const warnings: ReviewListWarning[] = [];
  let isComplete = true;
  for (const { id, result } of results) {
    if (!result.ok) {
      isComplete = false;
      warnings.push({ kind: "unreadable_review", reviewId: id });
      continue;
    }
    const { diagnostics, metadata } = result.value;
    appendSalvageWarning(warnings, metadata, diagnostics);
    items.push(metadata);
  }

  const sortedItems = filterByProjectAndSort(items, projectPath, "createdAt");
  const migratedItems = await migrateMetadataList(sortedItems);
  return ok({ items: migratedItems, warnings, isComplete });
}

async function scanReviewsForCertification(projectPath: string): Promise<ReviewMetadata[]> {
  const idsResult = await readReviewIds();
  if (!idsResult.ok) {
    throw new Error(`Failed to certify reviews: ${idsResult.error.message}`, {
      cause: idsResult.error,
    });
  }

  const results = await readReviewMetadata(idsResult.value);
  const items: ReviewMetadata[] = [];
  for (const { id, result } of results) {
    if (!result.ok) {
      if (
        result.error.code === "NOT_FOUND" ||
        result.error.code === "PARSE_ERROR" ||
        result.error.code === "VALIDATION_ERROR"
      ) {
        continue;
      }
      throw new Error(`Failed to certify review ${id}: ${result.error.message}`);
    }
    if (result.value.metadata.projectPath === projectPath) items.push(result.value.metadata);
  }
  return migrateMetadataList(filterByProjectAndSort(items, projectPath, "createdAt"));
}

async function listReviewsFromFullScan(
  projectPath?: string,
  persistEmptyIndex = false,
): Promise<Result<{ items: ReviewMetadata[]; warnings: ReviewListWarning[] }, StoreError>> {
  if (!projectPath) return scanReviews();

  return withProjectIndexLock(projectPath, async () => {
    const result = await scanReviews(projectPath);
    if (!result.ok) return result;
    if (!persistEmptyIndex && result.value.items.length === 0) return result;

    try {
      await writeCursorProjectIndexLocked(projectPath, result.value.items, {
        completeSnapshot: result.value.isComplete,
      });
    } catch (error) {
      log("warn", "reviews_index_build_failed", { error });
      result.value.warnings.push({ kind: "index_build_failed" });
      return result;
    }
    await clearReconcileMarker(projectPath).catch((error) =>
      log("warn", "reviews_index_clear_reconcile_failed", { error }),
    );

    return result;
  });
}

export interface ReviewPageOptions {
  cursor?: string;
  limit: number;
}

export interface ReviewPage {
  items: ReviewMetadata[];
  warnings: ReviewListWarning[];
  nextCursor: string | null;
}

function paginateSortedItems(
  items: ReviewMetadata[],
  { cursor, limit }: ReviewPageOptions,
  warnings: ReviewListWarning[],
): ReviewPage {
  const boundary = cursor ? decodeReviewCursor(cursor) : null;
  const start = boundary ? items.findIndex((item) => compareReviewOrder(item, boundary) > 0) : 0;
  const normalizedStart = start === -1 ? items.length : start;
  const pageItems = items.slice(normalizedStart, normalizedStart + limit);
  const hasMore = normalizedStart + pageItems.length < items.length;
  const lastItem = pageItems.at(-1);
  return {
    items: pageItems,
    warnings,
    nextCursor: hasMore && lastItem ? encodeReviewCursor(lastItem) : null,
  };
}

function findPageStart(
  entries: ProjectIndexEntry[],
  boundary: ReviewCursorBoundary | null,
): number {
  if (!boundary) return 0;

  let low = 0;
  let high = entries.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    const entry = entries[middle];
    if (entry && compareReviewOrder(entry, boundary) <= 0) low = middle + 1;
    else high = middle;
  }
  return low;
}

async function listIndexedReviewPage(
  projectPath: string,
  entries: ProjectIndexEntry[],
  options: ReviewPageOptions,
): Promise<Result<ReviewPage, StoreError>> {
  const boundary = options.cursor ? decodeReviewCursor(options.cursor) : null;
  const start = findPageStart(entries, boundary);
  const slice = entries.slice(start, start + options.limit + 1);
  const collected: Array<{ entry: ProjectIndexEntry; metadata: ReviewMetadata }> = [];
  const invalidIds = new Set<string>();
  const warnings: ReviewListWarning[] = [];
  const metadataResults = await readReviewMetadata(slice.map((entry) => entry.id));
  const results = metadataResults.map(({ result }, index) => ({
    entry: slice[index],
    result,
  }));

  for (const { entry, result } of results) {
    if (!entry) continue;
    if (!result.ok) {
      if (result.error.code === "NOT_FOUND") invalidIds.add(entry.id);
      else warnings.push({ kind: "unreadable_review", reviewId: entry.id });
      continue;
    }
    const { diagnostics, metadata } = result.value;
    if (metadata.projectPath !== projectPath) {
      invalidIds.add(entry.id);
      continue;
    }
    appendSalvageWarning(warnings, metadata, diagnostics);
    collected.push({ entry, metadata });
  }

  if (invalidIds.size > 0) {
    try {
      await removeInvalidProjectIndexEntries(projectPath, invalidIds);
    } catch (error) {
      log("warn", "reviews_index_rewrite_failed", { error });
      warnings.push({ kind: "index_rewrite_failed" });
    }
  }

  const pageItems = collected.slice(0, options.limit).map(({ metadata }) => metadata);
  const migratedPageItems = await migrateMetadataList(pageItems);
  const lookahead = collected.length > options.limit;
  let nextCursor: string | null = null;
  if (lookahead) {
    const lastReturned = collected[options.limit - 1];
    nextCursor = lastReturned ? encodeReviewCursor(lastReturned.entry) : null;
  } else if (start + slice.length < entries.length) {
    const lastScanned = slice.at(-1);
    nextCursor = lastScanned ? encodeReviewCursor(lastScanned) : null;
  }

  return ok({
    items: migratedPageItems,
    warnings,
    nextCursor,
  });
}

/** Lists one newest-first page while using the project index as the cursor order. */
export async function listReviewPage(
  projectPath: string,
  options: ReviewPageOptions,
): Promise<Result<ReviewPage, StoreError>> {
  const [indexResult, needsReconcile, isCursorOrdered] = await withProjectIndexLock(
    projectPath,
    () =>
      Promise.all([
        readProjectIndexData(projectPath),
        hasReconcileMarker(projectPath),
        hasCursorIndexMarker(projectPath),
      ]),
  );
  const { entries, isCanonical } =
    indexResult.kind === "valid" ? indexResult.data : emptyProjectIndexData();
  const needsBootstrap = needsReconcile || !isCursorOrdered || !entries || !isCanonical;
  if (needsBootstrap) {
    const fullResult = await listReviewsFromFullScan(projectPath, true);
    if (!fullResult.ok) return fullResult;
    return ok(paginateSortedItems(fullResult.value.items, options, fullResult.value.warnings));
  }

  return listIndexedReviewPage(projectPath, entries, options);
}

export async function getReview(reviewId: string): Promise<Result<SavedReview, StoreError>> {
  const result = await reviewStore.readDetailed(reviewId);
  if (!result.ok) return result;

  const review = result.value.item;
  if (result.value.diagnostics?.droppedIssueCount) {
    log("warn", "review_issues_salvaged", {
      reviewId,
      droppedIssueCount: result.value.diagnostics.droppedIssueCount,
    });
  }
  const migrated = migrateReview(review);
  if (migrated) {
    if (!result.value.salvaged) {
      void persistMigrationLocked(review.metadata.id);
    }
    return ok(migrated);
  }

  return ok(review);
}

// Move a project's stored review history to a new path (repo dir moved/renamed):
// rewrite each matching review's metadata.projectPath under its lock and migrate the
// sha256(projectPath) index file to the new key.
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
        migrationFailed = true;
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
  }

  if (migrationFailed) return false;

  return migrateProjectIndexFile(oldProjectPath, newProjectPath, rekeyed, ids, isRecoveryAttempt);
}

async function scanProjectReviewIds(projectPath: string): Promise<string[]> {
  return (await scanReviewsForCertification(projectPath)).map((metadata) => metadata.id);
}

async function migrateProjectIndexFile(
  oldProjectPath: string,
  newProjectPath: string,
  rekeyedItems: ReviewMetadata[],
  sourceIds: readonly string[],
  isRecoveryAttempt: boolean,
): Promise<boolean> {
  const requiredIds = new Set(sourceIds);
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

  if (rekeyedItems.length > 0) {
    try {
      await writeCursorProjectIndex(newProjectPath, rekeyedItems);
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
      if (!invalidated && !isRecoveryAttempt) {
        await markProjectReconcile(newProjectPath).catch((markerError) =>
          log("warn", "reviews_rekeyed_destination_index_mark_reconcile_failed", {
            error: markerError,
          }),
        );
      }
      // The source index is the durable retry set for already-rekeyed review
      // files. A later destination listing/rekey retry must prove the merged
      // existing + moved set before source cleanup is allowed.
      return false;
    }
  }

  if (isRecoveryAttempt) {
    const isComplete = await isCanonicalCursorIndexContaining(newProjectPath, requiredIds);
    if (!isComplete) return false;
    await clearReconcileMarker(newProjectPath);
  }
  return removeMigratedSourceIndex(oldProjectPath);
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
