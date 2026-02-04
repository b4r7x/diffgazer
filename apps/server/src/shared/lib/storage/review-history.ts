import { randomUUID } from "node:crypto";
import { join } from "node:path";
import {
  SavedReviewSchema,
  type SavedReview,
  type ReviewHistoryMetadata,
  type ReviewGitContext,
  type ReviewResult,
} from "@stargazer/schemas";
import { createCollection, filterByProjectAndSort, type StoreError } from "./persistence.js";
import { getGlobalStargazerDir } from "../paths.js";
import { type Result, ok } from "@stargazer/core";

const REVIEWS_DIR = join(getGlobalStargazerDir(), "reviews");
const getReviewFile = (reviewId: string): string =>
  join(REVIEWS_DIR, `${reviewId}.json`);

export const reviewStore = createCollection<SavedReview, ReviewHistoryMetadata>({
  name: "review",
  dir: REVIEWS_DIR,
  filePath: getReviewFile,
  schema: SavedReviewSchema,
  getMetadata: (review) => review.metadata,
  getId: (review) => review.metadata.id,
});

function countIssuesBySeverity(
  issues: ReviewResult["issues"],
  severity: "critical" | "warning"
): number {
  return issues.filter((issue) => issue.severity === severity).length;
}

export async function saveReview(
  projectPath: string,
  staged: boolean,
  result: ReviewResult,
  gitContext: ReviewGitContext
): Promise<Result<ReviewHistoryMetadata, StoreError>> {
  const now = new Date().toISOString();
  const metadata: ReviewHistoryMetadata = {
    id: randomUUID(),
    projectPath,
    createdAt: now,
    staged,
    branch: gitContext.branch,
    overallScore: result.overallScore,
    issueCount: result.issues.length,
    criticalCount: countIssuesBySeverity(result.issues, "critical"),
    warningCount: countIssuesBySeverity(result.issues, "warning"),
  };

  const savedReview: SavedReview = { metadata, result, gitContext };
  const writeResult = await reviewStore.write(savedReview);
  if (!writeResult.ok) return writeResult;
  return ok(metadata);
}

export async function listReviews(
  projectPath?: string
): Promise<Result<{ items: ReviewHistoryMetadata[]; warnings: string[] }, StoreError>> {
  const result = await reviewStore.list();
  if (!result.ok) return result;

  const items = filterByProjectAndSort(result.value.items, projectPath, "createdAt");
  return ok({ items, warnings: result.value.warnings });
}
