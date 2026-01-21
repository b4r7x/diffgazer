import { randomUUID } from "node:crypto";
import { paths } from "./paths.js";
import { createJsonStore, filterByProjectAndSort, type StoreError } from "./json-store.js";
import {
  SavedReviewSchema,
  type SavedReview,
  type ReviewHistoryMetadata,
  type ReviewGitContext,
} from "@repo/schemas/review-history";
import type { ReviewResult } from "@repo/schemas/review";
import type { Result } from "../result.js";
import { ok } from "../result.js";

export type ReviewHistoryError = StoreError;

const reviewStore = createJsonStore<SavedReview, ReviewHistoryMetadata>({
  name: "review",
  dir: paths.reviews,
  filePath: paths.reviewFile,
  schema: SavedReviewSchema,
  getMetadata: (r) => r.metadata,
  getId: (r) => r.metadata.id,
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
): Promise<Result<ReviewHistoryMetadata, ReviewHistoryError>> {
  const now = new Date().toISOString();
  const metadata: ReviewHistoryMetadata = {
    id: randomUUID(),
    projectPath,
    createdAt: now,
    staged,
    branch: gitContext.branch,
    overallScore: result.overallScore ?? null,
    issueCount: result.issues.length,
    criticalCount: countIssuesBySeverity(result.issues, "critical"),
    warningCount: countIssuesBySeverity(result.issues, "warning"),
  };

  const savedReview: SavedReview = { metadata, result, gitContext };
  const writeResult = await reviewStore.write(savedReview);
  if (!writeResult.ok) return writeResult;
  return ok(metadata);
}

export const readReview = reviewStore.read;

export async function listReviews(
  projectPath?: string
): Promise<Result<{ items: ReviewHistoryMetadata[]; warnings: string[] }, ReviewHistoryError>> {
  const result = await reviewStore.list();
  if (!result.ok) return result;

  const items = filterByProjectAndSort(result.value.items, projectPath, "createdAt");
  return ok({ items, warnings: result.value.warnings });
}

export async function deleteReview(
  reviewId: string
): Promise<Result<void, ReviewHistoryError>> {
  const result = await reviewStore.remove(reviewId);
  if (!result.ok) return result;
  return ok(undefined);
}
