import * as fs from "node:fs";
import * as path from "node:path";
import {
  listJsonFilesSync,
  readJsonFileSync,
  removeFileSync,
  writeJsonFileSync,
} from "../../shared/lib/json-storage.js";
import {
  getGlobalReviewFile,
  getGlobalReviewsDir,
  getProjectReviewFile,
  getProjectReviewsDir,
} from "../../shared/lib/paths.js";
import type { ReviewHistoryMetadata, SavedReview } from "./types.js";

const normalizePath = (value: string | undefined): string | null => {
  if (!value) return null;
  return path.resolve(value);
};

const migratedProjects = new Set<string>();

const sortByCreatedAtDesc = (items: ReviewHistoryMetadata[]): ReviewHistoryMetadata[] =>
  [...items].sort((left, right) => {
    const leftValue = left.createdAt ?? "";
    const rightValue = right.createdAt ?? "";
    return rightValue.localeCompare(leftValue);
  });

const readReviewFile = (filePath: string): SavedReview | null =>
  readJsonFileSync<SavedReview>(filePath);

const migrateLegacyReviews = (projectRoot: string): void => {
  const legacyDir = getGlobalReviewsDir();
  const legacyFiles = listJsonFilesSync(legacyDir);
  const projectRootResolved = path.resolve(projectRoot);

  if (migratedProjects.has(projectRootResolved)) return;
  if (legacyFiles.length === 0) {
    migratedProjects.add(projectRootResolved);
    return;
  }

  for (const filePath of legacyFiles) {
    const review = readReviewFile(filePath);
    if (!review) continue;

    const reviewPath = normalizePath(review.metadata.projectPath);
    if (!reviewPath || reviewPath !== projectRootResolved) continue;

    const targetFile = getProjectReviewFile(projectRootResolved, review.metadata.id);
    if (fs.existsSync(targetFile)) continue;

    writeJsonFileSync(targetFile, review, 0o600);
  }

  migratedProjects.add(projectRootResolved);
};

export const listReviews = (projectRoot: string): ReviewHistoryMetadata[] => {
  migrateLegacyReviews(projectRoot);

  const reviewDir = getProjectReviewsDir(projectRoot);
  const files = listJsonFilesSync(reviewDir);
  const items: ReviewHistoryMetadata[] = [];

  for (const filePath of files) {
    const review = readReviewFile(filePath);
    if (!review) continue;
    items.push({ ...review.metadata });
  }

  return sortByCreatedAtDesc(items);
};

export const getReview = (projectRoot: string, id: string): SavedReview | null => {
  const reviewFile = getProjectReviewFile(projectRoot, id);
  const direct = readReviewFile(reviewFile);
  if (direct) return direct;

  const legacyFile = getGlobalReviewFile(id);
  const legacyReview = readReviewFile(legacyFile);
  const legacyPath = normalizePath(legacyReview?.metadata.projectPath);
  const projectRootResolved = path.resolve(projectRoot);

  if (!legacyReview || legacyPath !== projectRootResolved) return null;

  const targetFile = getProjectReviewFile(projectRootResolved, id);
  if (!fs.existsSync(targetFile)) {
    writeJsonFileSync(targetFile, legacyReview, 0o600);
  }

  return legacyReview;
};

export const deleteReview = (projectRoot: string, id: string): boolean => {
  const reviewFile = getProjectReviewFile(projectRoot, id);
  const deleted = removeFileSync(reviewFile);

  if (!deleted) {
    const legacyFile = getGlobalReviewFile(id);
    return removeFileSync(legacyFile);
  }

  return deleted;
};
