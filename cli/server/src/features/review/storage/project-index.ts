import { createHash } from "node:crypto";
import { mkdir, readFile, stat, unlink } from "node:fs/promises";
import { join } from "node:path";
import { UuidSchema } from "@diffgazer/core/schemas/fields";
import type { ReviewMetadata } from "@diffgazer/core/schemas/review";
import { ReviewMetadataSchema } from "@diffgazer/core/schemas/review";
import { withFileTransactionLock } from "../../../shared/lib/config/transaction/file-lock.js";
import { atomicWriteFile, isNodeError, restrictDirectoryMode } from "../../../shared/lib/fs.js";
import { log } from "../../../shared/lib/log.js";
import { getGlobalDiffgazerDir } from "../../../shared/lib/paths.js";
import { compareReviewOrder, type ReviewCursorBoundary } from "./cursor.js";
import { createKeyedLock } from "./keyed-lock.js";

// Legacy on-disk directory name kept as "triage-reviews" to avoid data migration
export const REVIEWS_DIR = join(getGlobalDiffgazerDir(), "triage-reviews");
const PROJECT_INDEX_DIR = join(REVIEWS_DIR, ".index");
const CURSOR_INDEX_MARKER = "createdAt+id-v1\n";
const MAX_CACHED_PROJECT_INDEXES = 16;

export const isValidUuid = (id: string): boolean => UuidSchema.safeParse(id).success;

function projectHash(projectPath: string): string {
  return createHash("sha256").update(projectPath).digest("hex").slice(0, 16);
}

export function projectIndexPath(projectPath: string): string {
  return join(PROJECT_INDEX_DIR, `${projectHash(projectPath)}.json`);
}

// Staleness signal gating the cross-project orphan reconcile: dropped when a saved
// review could neither be indexed nor cleared by invalidation. Absent it, listings
// serve straight from the per-project index.
function projectReconcileMarkerPath(projectPath: string): string {
  return join(PROJECT_INDEX_DIR, `${projectHash(projectPath)}.reconcile`);
}

function projectCursorIndexMarkerPath(projectPath: string): string {
  return join(PROJECT_INDEX_DIR, `${projectHash(projectPath)}.cursor-v1`);
}

export type ProjectIndexEntry = ReviewCursorBoundary & {
  /** Metadata snapshot so a metadata-only page never opens the review payload. */
  metadata?: ReviewMetadata;
  /** Issues the durable record lost to salvage, so an indexed page warns like a scan. */
  droppedIssueCount?: number;
  /** Set when salvage could not recover the record's terminal execution. */
  droppedExecution?: true;
};

export interface ProjectIndexData {
  entries: ProjectIndexEntry[] | null;
  ids: string[];
  isCanonical: boolean;
  needsRewrite: boolean;
}

export type ProjectIndexReadResult =
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

// Certification scan is owned by the review store; the index writer receives it as a
// callback to avoid a project-index -> reviews module cycle.
export type CertificationScanner = (projectPath: string) => Promise<ReviewMetadata[]>;

const projectIndexCache = new Map<string, CachedProjectIndex>();

export function emptyProjectIndexData(): ProjectIndexData {
  return { entries: null, ids: [], isCanonical: false, needsRewrite: false };
}

function isProjectIndexEntry(value: unknown): value is ProjectIndexEntry {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<ProjectIndexEntry>;
  const timestamp = typeof candidate.createdAt === "string" ? Date.parse(candidate.createdAt) : NaN;
  const hasValidMetadata =
    candidate.metadata === undefined || ReviewMetadataSchema.safeParse(candidate.metadata).success;
  const hasValidDropCount =
    candidate.droppedIssueCount === undefined ||
    (Number.isInteger(candidate.droppedIssueCount) && candidate.droppedIssueCount > 0);
  const hasValidDroppedExecution =
    candidate.droppedExecution === undefined || candidate.droppedExecution === true;
  return (
    typeof candidate.createdAt === "string" &&
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString() === candidate.createdAt &&
    typeof candidate.id === "string" &&
    isValidUuid(candidate.id) &&
    hasValidMetadata &&
    hasValidDropCount &&
    hasValidDroppedExecution
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

export function invalidateCachedProjectIndex(projectPath: string): void {
  projectIndexCache.delete(projectIndexPath(projectPath));
}

export async function readProjectIndexData(projectPath: string): Promise<ProjectIndexReadResult> {
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
  await restrictDirectoryMode(PROJECT_INDEX_DIR, 0o700);
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

export function withProjectIndexLock<T>(projectPath: string, fn: () => Promise<T>): Promise<T> {
  const indexPath = projectIndexPath(projectPath);
  return withFileTransactionLock(indexPath, () => lockProjectIndex(indexPath, fn));
}

export async function writeCursorProjectIndexLocked(
  projectPath: string,
  sortedItems: ReviewMetadata[],
  scanForCertification: CertificationScanner,
  options: {
    completeSnapshot?: boolean;
    excludedIds?: ReadonlySet<string>;
    /** Salvage losses observed while reading each record, keyed by review id. */
    droppedIssueCounts?: ReadonlyMap<string, number>;
    /** Review ids whose terminal execution the salvage read could not recover. */
    droppedExecutionIds?: ReadonlySet<string>;
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
      const scannedItems = await scanForCertification(projectPath);
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
      const droppedIssueCount = options.droppedIssueCounts?.get(item.id);
      entriesById.set(item.id, {
        id: item.id,
        createdAt: new Date(item.createdAt).toISOString(),
        metadata: item,
        ...(droppedIssueCount ? { droppedIssueCount } : {}),
        ...(options.droppedExecutionIds?.has(item.id) ? { droppedExecution: true as const } : {}),
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

export function writeCursorProjectIndex(
  projectPath: string,
  sortedItems: ReviewMetadata[],
  scanForCertification: CertificationScanner,
  excludedIds: ReadonlySet<string> = new Set(),
): Promise<ProjectIndexEntry[]> {
  return withProjectIndexLock(projectPath, () =>
    writeCursorProjectIndexLocked(projectPath, sortedItems, scanForCertification, { excludedIds }),
  );
}

export async function addToProjectIndex(
  metadata: ReviewMetadata,
  scanForCertification: CertificationScanner,
): Promise<void> {
  await writeCursorProjectIndex(metadata.projectPath, [metadata], scanForCertification);
}

export async function removeInvalidProjectIndexEntries(
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
export async function invalidateProjectIndex(projectPath: string): Promise<void> {
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

export async function markProjectReconcile(projectPath: string): Promise<void> {
  await mkdir(PROJECT_INDEX_DIR, { recursive: true, mode: 0o700 });
  await restrictDirectoryMode(PROJECT_INDEX_DIR, 0o700);
  await atomicWriteFile(projectReconcileMarkerPath(projectPath), "");
}

export async function hasReconcileMarker(projectPath: string): Promise<boolean> {
  try {
    await stat(projectReconcileMarkerPath(projectPath));
    return true;
  } catch {
    return false;
  }
}

export async function clearReconcileMarker(projectPath: string): Promise<void> {
  try {
    await unlink(projectReconcileMarkerPath(projectPath));
  } catch (error) {
    if (!isNodeError(error, "ENOENT")) throw error;
  }
}

export async function hasCursorIndexMarker(projectPath: string): Promise<boolean> {
  try {
    return (
      (await readFile(projectCursorIndexMarkerPath(projectPath), "utf-8")) === CURSOR_INDEX_MARKER
    );
  } catch {
    return false;
  }
}

export async function clearCursorIndexMarker(projectPath: string): Promise<void> {
  try {
    await unlink(projectCursorIndexMarkerPath(projectPath));
  } catch (error) {
    if (!isNodeError(error, "ENOENT")) throw error;
  }
}

async function markCursorIndex(projectPath: string): Promise<void> {
  await atomicWriteFile(projectCursorIndexMarkerPath(projectPath), CURSOR_INDEX_MARKER);
}
