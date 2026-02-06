import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  SavedReviewSchema,
  ReviewMetadataSchema,
  type SavedReview,
  type ReviewMetadata,
  type ReviewGitContext,
  type DrilldownResult,
} from "@stargazer/schemas/review";
import { createCollection } from "./persistence.js";
import type { StoreError, DateFieldsOf, SaveReviewOptions } from "./types.js";
import { getGlobalStargazerDir } from "../paths.js";
import { type Result, ok, calculateSeverityCounts } from "@stargazer/core";

function filterByProjectAndSort<T extends { projectPath: string }>(
  items: T[],
  projectPath: string | undefined,
  dateField: DateFieldsOf<T>
): T[] {
  const filtered = projectPath ? items.filter((item) => item.projectPath === projectPath) : items;
  return filtered.sort(
    (a, b) =>
      new Date(b[dateField] as string).getTime() - new Date(a[dateField] as string).getTime()
  );
}

// Legacy on-disk directory name kept as "triage-reviews" to avoid data migration
const REVIEWS_DIR = join(getGlobalStargazerDir(), "triage-reviews");
const getReviewFile = (reviewId: string): string =>
  join(REVIEWS_DIR, `${reviewId}.json`);

const reviewStore = createCollection<SavedReview, ReviewMetadata>({
  name: "review",
  dir: REVIEWS_DIR,
  filePath: getReviewFile,
  schema: SavedReviewSchema,
  metadataSchema: ReviewMetadataSchema,
  getMetadata: (review) => review.metadata,
  getId: (review) => review.metadata.id,
});

/**
 * Migrates a review by recalculating severity counts from issues.
 * Returns true if migration was applied.
 */
function migrateReview(review: SavedReview): boolean {
  const { metadata } = review;
  const { issues } = review.result;

  if (issues.length === 0) return false;

  const totalCounted =
    metadata.blockerCount + metadata.highCount + metadata.mediumCount + metadata.lowCount + metadata.nitCount;

  if (totalCounted > 0 || metadata.issueCount === 0) return false;

  const counts = calculateSeverityCounts(issues);
  metadata.blockerCount = counts.blocker;
  metadata.highCount = counts.high;
  metadata.mediumCount = counts.medium;
  metadata.lowCount = counts.low;
  metadata.nitCount = counts.nit;
  return true;
}

export async function saveReview(
  options: SaveReviewOptions
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
    gitContext,
    drilldowns: options.drilldowns ?? [],
  };

  const writeResult = await reviewStore.write(savedReview);
  if (!writeResult.ok) return writeResult;
  return ok(metadata);
}

export async function addDrilldownToReview(
  reviewId: string,
  drilldown: DrilldownResult
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

export async function listReviews(
  projectPath?: string
): Promise<Result<{ items: ReviewMetadata[]; warnings: string[] }, StoreError>> {
  const result = await reviewStore.list();
  if (!result.ok) return result;

  const items = filterByProjectAndSort(result.value.items, projectPath, "createdAt");

  // Migrate old reviews that have missing severity counts
  const migratedItems = await Promise.all(
    items.map(async (metadata) => {
      const totalCounted =
        metadata.blockerCount + metadata.highCount + metadata.mediumCount + metadata.lowCount + metadata.nitCount;

      if (totalCounted === 0 && metadata.issueCount > 0) {
        const reviewResult = await reviewStore.read(metadata.id);
        if (!reviewResult.ok) return metadata;

        const review = reviewResult.value;
        if (migrateReview(review)) {
          reviewStore.write(review).catch(() => {});
          return review.metadata;
        }
      }

      return metadata;
    })
  );

  return ok({ items: migratedItems, warnings: result.value.warnings });
}

export async function getReview(
  reviewId: string
): Promise<Result<SavedReview, StoreError>> {
  const result = await reviewStore.read(reviewId);
  if (!result.ok) return result;

  const review = result.value;
  if (migrateReview(review)) {
    // Persist migrated data in background (fire and forget)
    reviewStore.write(review).catch(() => {});
  }

  return ok(review);
}

export async function deleteReview(
  reviewId: string
): Promise<Result<{ existed: boolean }, StoreError>> {
  return reviewStore.remove(reviewId);
}
