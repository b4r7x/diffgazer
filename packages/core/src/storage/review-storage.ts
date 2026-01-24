import { randomUUID } from "node:crypto";
import { paths } from "./paths.js";
import { createCollection, filterByProjectAndSort, type StoreError } from "./persistence.js";
import {
  SavedTriageReviewSchema,
  type SavedTriageReview,
  type TriageReviewMetadata,
  type TriageGitContext,
} from "@repo/schemas/triage-storage";
import type { TriageResult, TriageSeverity } from "@repo/schemas/triage";
import type { LensId, ProfileId, DrilldownResult } from "@repo/schemas/lens";
import type { ParsedDiff } from "../diff/types.js";
import type { Result } from "../result.js";
import { ok } from "../result.js";

export const triageReviewStore = createCollection<SavedTriageReview, TriageReviewMetadata>({
  name: "triage-review",
  dir: paths.triageReviews,
  filePath: paths.triageReviewFile,
  schema: SavedTriageReviewSchema,
  getMetadata: (review) => review.metadata,
  getId: (review) => review.metadata.id,
});

function countIssuesBySeverity(
  issues: TriageResult["issues"],
  severity: TriageSeverity
): number {
  return issues.filter((issue) => issue.severity === severity).length;
}

export interface SaveTriageReviewOptions {
  projectPath: string;
  staged: boolean;
  result: TriageResult;
  diff: ParsedDiff;
  branch: string | null;
  commit: string | null;
  profile?: ProfileId;
  lenses: LensId[];
  drilldowns?: DrilldownResult[];
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

  const metadata: TriageReviewMetadata = {
    id: randomUUID(),
    projectPath: options.projectPath,
    createdAt: now,
    staged: options.staged,
    branch: options.branch,
    profile: options.profile ?? null,
    lenses: options.lenses,
    issueCount: options.result.issues.length,
    blockerCount: countIssuesBySeverity(options.result.issues, "blocker"),
    highCount: countIssuesBySeverity(options.result.issues, "high"),
    fileCount: options.diff.totalStats.filesChanged,
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
  return ok({ items, warnings: result.value.warnings });
}

export async function getTriageReview(
  reviewId: string
): Promise<Result<SavedTriageReview, StoreError>> {
  return triageReviewStore.read(reviewId);
}

export async function deleteTriageReview(
  reviewId: string
): Promise<Result<{ existed: boolean }, StoreError>> {
  return triageReviewStore.remove(reviewId);
}
