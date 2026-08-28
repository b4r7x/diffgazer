import type { Dirent } from "node:fs";
import { readdir } from "node:fs/promises";
import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { ReviewListWarning, ReviewMetadata } from "@diffgazer/core/schemas/review";
import { isNodeError } from "../../../shared/lib/fs.js";
import { log } from "../../../shared/lib/log.js";
import {
  compareReviewOrder,
  decodeReviewCursor,
  encodeReviewCursor,
  type ReviewCursorBoundary,
} from "./cursor.js";
import type { ReviewSalvageDiagnostics } from "./lenient-read.js";
import { migrateReview, persistMigrationLocked, presentDurableReviewMetadata } from "./migrate.js";
import {
  clearReconcileMarker,
  emptyProjectIndexData,
  hasCursorIndexMarker,
  hasReconcileMarker,
  isValidUuid,
  type ProjectIndexEntry,
  REVIEWS_DIR,
  readProjectIndexData,
  removeInvalidProjectIndexEntries,
  withProjectIndexLock,
  writeCursorProjectIndexLocked,
} from "./project-index.js";
import { reviewStore } from "./store.js";
import type { StoreError, StoreErrorCode } from "./types.js";

const createStoreError = createError<StoreErrorCode>;

function filterByProjectAndSort<T extends { id: string; projectPath: string; createdAt: string }>(
  items: T[],
  projectPath: string,
): T[] {
  return items
    .filter((item) => item.projectPath === projectPath)
    .sort((a, b) =>
      compareReviewOrder(
        { id: a.id, createdAt: a.createdAt },
        { id: b.id, createdAt: b.createdAt },
      ),
    );
}

const MAX_CONCURRENT_REVIEW_READS = 8;

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
        metadata: presentDurableReviewMetadata(result.value.item),
        diagnostics: result.value.diagnostics,
      }),
    };
  });
}

export function appendSalvageWarnings(
  warnings: ReviewListWarning[],
  metadata: ReviewMetadata,
  diagnostics: ReviewSalvageDiagnostics | null,
): void {
  if (!diagnostics) return;
  if (diagnostics.droppedIssueCount > 0) {
    warnings.push({
      kind: "invalid_issues_dropped",
      reviewId: metadata.id,
      count: diagnostics.droppedIssueCount,
    });
  }
  if (diagnostics.droppedExecution) {
    warnings.push({ kind: "invalid_execution_dropped", reviewId: metadata.id });
  }
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
        return presentDurableReviewMetadata(migrated);
      }

      return presentDurableReviewMetadata(reviewResult.value);
    }

    return metadata;
  });
}

async function scanReviews(projectPath: string): Promise<
  Result<
    {
      items: ReviewMetadata[];
      warnings: ReviewListWarning[];
      isComplete: boolean;
      droppedIssueCounts: Map<string, number>;
      droppedExecutionIds: Set<string>;
    },
    StoreError
  >
> {
  const idsResult = await readReviewIds();
  if (!idsResult.ok) return idsResult;

  const results = await readReviewMetadata(idsResult.value);
  const items: ReviewMetadata[] = [];
  const warnings: ReviewListWarning[] = [];
  const droppedIssueCounts = new Map<string, number>();
  const droppedExecutionIds = new Set<string>();
  let isComplete = true;
  for (const { id, result } of results) {
    if (!result.ok) {
      isComplete = false;
      warnings.push({ kind: "unreadable_review", reviewId: id });
      continue;
    }
    const { diagnostics, metadata } = result.value;
    appendSalvageWarnings(warnings, metadata, diagnostics);
    if (diagnostics && diagnostics.droppedIssueCount > 0) {
      droppedIssueCounts.set(metadata.id, diagnostics.droppedIssueCount);
    }
    if (diagnostics?.droppedExecution) droppedExecutionIds.add(metadata.id);
    items.push(metadata);
  }

  const sortedItems = filterByProjectAndSort(items, projectPath);
  const migratedItems = await migrateMetadataList(sortedItems);
  return ok({
    items: migratedItems,
    warnings,
    isComplete,
    droppedIssueCounts,
    droppedExecutionIds,
  });
}

export async function scanReviewsForCertification(projectPath: string): Promise<ReviewMetadata[]> {
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
  // Certification consumers keep only id/createdAt, so migrating here would
  // re-read and re-validate every legacy record for fields nobody reads. The
  // listing and detail paths migrate on their own.
  return filterByProjectAndSort(items, projectPath);
}

async function listReviewsFromFullScan(
  projectPath: string,
): Promise<Result<{ items: ReviewMetadata[]; warnings: ReviewListWarning[] }, StoreError>> {
  return withProjectIndexLock(projectPath, async () => {
    const result = await scanReviews(projectPath);
    if (!result.ok) return result;

    try {
      await writeCursorProjectIndexLocked(
        projectPath,
        result.value.items,
        scanReviewsForCertification,
        {
          completeSnapshot: result.value.isComplete,
          droppedIssueCounts: result.value.droppedIssueCounts,
          droppedExecutionIds: result.value.droppedExecutionIds,
        },
      );
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
  const idsNeedingRead: string[] = [];

  for (const entry of slice) {
    if (!entry.metadata) {
      idsNeedingRead.push(entry.id);
    }
  }

  const metadataResults = idsNeedingRead.length > 0 ? await readReviewMetadata(idsNeedingRead) : [];
  const resultsById = new Map(metadataResults.map(({ id, result }) => [id, result] as const));

  for (const entry of slice) {
    if (entry.metadata) {
      if (entry.metadata.projectPath !== projectPath) {
        invalidIds.add(entry.id);
        continue;
      }
      appendSalvageWarnings(warnings, entry.metadata, {
        droppedIssueCount: entry.droppedIssueCount ?? 0,
        droppedExecution: entry.droppedExecution === true,
      });
      collected.push({ entry, metadata: entry.metadata });
      continue;
    }

    const result = resultsById.get(entry.id);
    if (!result) continue;
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
    appendSalvageWarnings(warnings, metadata, diagnostics);
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
    const fullResult = await listReviewsFromFullScan(projectPath);
    if (!fullResult.ok) return fullResult;
    return ok(paginateSortedItems(fullResult.value.items, options, fullResult.value.warnings));
  }

  return listIndexedReviewPage(projectPath, entries, options);
}
