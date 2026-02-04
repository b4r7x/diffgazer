import { randomUUID } from "node:crypto";
import { paths } from "./paths.js";
import { createCollection, filterByProjectAndSort, type StoreError } from "./persistence.js";
import {
  SavedTriageReviewSchema,
  TriageReviewMetadataSchema,
  type SavedTriageReview,
  type TriageReviewMetadata,
  type TriageGitContext,
  type TriageResult,
  type LensId,
  type ProfileId,
  type DrilldownResult,
  type ReviewMode,
} from "@stargazer/schemas";
import type { ParsedDiff } from "../diff/index.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";

export const triageReviewStore = createCollection<SavedTriageReview, TriageReviewMetadata>({
  name: "triage-review",
  dir: paths.triageReviews,
  filePath: paths.triageReviewFile,
  schema: SavedTriageReviewSchema,
  metadataSchema: TriageReviewMetadataSchema,
  getMetadata: (review) => review.metadata,
  getId: (review) => review.metadata.id,
});

type SeverityCounts = {
  blocker: number;
  high: number;
  medium: number;
  low: number;
  nit: number;
};

function countSeverities(issues: TriageResult["issues"]): SeverityCounts {
  const counts: SeverityCounts = { blocker: 0, high: 0, medium: 0, low: 0, nit: 0 };
  for (const issue of issues) {
    counts[issue.severity]++;
  }
  return counts;
}

/**
 * Migrates a review by recalculating severity counts from issues.
 * Returns true if migration was applied.
 */
function migrateReview(review: SavedTriageReview): boolean {
  const { metadata } = review;
  const { issues } = review.result;

  if (issues.length === 0) return false;

  const totalCounted =
    metadata.blockerCount + metadata.highCount + metadata.mediumCount + metadata.lowCount + metadata.nitCount;

  if (totalCounted > 0 || metadata.issueCount === 0) return false;

  const counts = countSeverities(issues);
  metadata.blockerCount = counts.blocker;
  metadata.highCount = counts.high;
  metadata.mediumCount = counts.medium;
  metadata.lowCount = counts.low;
  metadata.nitCount = counts.nit;
  return true;
}

export interface SaveTriageReviewOptions {
  reviewId?: string;
  projectPath: string;
  mode: ReviewMode;
  result: TriageResult;
  diff: ParsedDiff;
  branch: string | null;
  commit: string | null;
  profile?: ProfileId;
  lenses: LensId[];
  drilldowns?: DrilldownResult[];
  durationMs?: number;
}

export async function saveTriageReview(
  options: SaveTriageReviewOptions
): Promise<Result<TriageReviewMetadata, StoreError>> {
  const now = new Date().toISOString();

  const gitContext: TriageGitContext = {
    branch: options.branch,
    commit: options.commit,
    fileCount: options.diff.totalStats.filesChanged,
    additions: options.diff.totalStats.additions,
    deletions: options.diff.totalStats.deletions,
  };

  const severityCounts = countSeverities(options.result.issues);

  const metadata: TriageReviewMetadata = {
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

  const savedReview: SavedTriageReview = {
    metadata,
    result: options.result,
    gitContext,
    drilldowns: options.drilldowns ?? [],
  };

  const writeResult = await triageReviewStore.write(savedReview);
  if (!writeResult.ok) return writeResult;
  return ok(metadata);
}

export async function addDrilldownToReview(
  reviewId: string,
  drilldown: DrilldownResult
): Promise<Result<void, StoreError>> {
  const readResult = await triageReviewStore.read(reviewId);
  if (!readResult.ok) return readResult;

  const review = readResult.value;
  const existingIndex = review.drilldowns.findIndex((d) => d.issueId === drilldown.issueId);

  if (existingIndex >= 0) {
    review.drilldowns[existingIndex] = drilldown;
  } else {
    review.drilldowns.push(drilldown);
  }

  return triageReviewStore.write(review);
}

export async function listTriageReviews(
  projectPath?: string
): Promise<Result<{ items: TriageReviewMetadata[]; warnings: string[] }, StoreError>> {
  const result = await triageReviewStore.list();
  if (!result.ok) return result;

  const items = filterByProjectAndSort(result.value.items, projectPath, "createdAt");

  // Migrate old reviews that have missing severity counts
  const migratedItems = await Promise.all(
    items.map(async (metadata) => {
      const totalCounted =
        metadata.blockerCount + metadata.highCount + metadata.mediumCount + metadata.lowCount + metadata.nitCount;

      if (totalCounted === 0 && metadata.issueCount > 0) {
        const reviewResult = await triageReviewStore.read(metadata.id);
        if (!reviewResult.ok) return metadata;

        const review = reviewResult.value;
        if (migrateReview(review)) {
          triageReviewStore.write(review).catch(() => {});
          return review.metadata;
        }
      }

      return metadata;
    })
  );

  return ok({ items: migratedItems, warnings: result.value.warnings });
}

export async function getTriageReview(
  reviewId: string
): Promise<Result<SavedTriageReview, StoreError>> {
  const result = await triageReviewStore.read(reviewId);
  if (!result.ok) return result;

  const review = result.value;
  if (migrateReview(review)) {
    // Persist migrated data in background (fire and forget)
    triageReviewStore.write(review).catch(() => {});
  }

  return ok(review);
}

export async function deleteTriageReview(
  reviewId: string
): Promise<Result<{ existed: boolean }, StoreError>> {
  return triageReviewStore.remove(reviewId);
}
