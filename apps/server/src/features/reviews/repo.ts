import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  getGlobalReviewFile,
  getGlobalReviewsDir,
  getProjectReviewFile,
  getProjectReviewsDir,
} from "../../shared/lib/paths.js";
import type { ReviewHistoryMetadata, SavedReview } from "./types.js";

const DEFAULT_DIR_MODE = 0o700;
const DEFAULT_FILE_MODE = 0o600;

const ensureDirSync = (dirPath: string, mode: number = DEFAULT_DIR_MODE): void => {
  fs.mkdirSync(dirPath, { recursive: true, mode });
};

const readJsonFileSync = <T>(filePath: string): T | null => {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(content) as T;
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return null;
    }

    console.warn(`[stargazer] Failed to read JSON file: ${filePath}`);
    return null;
  }
};

const writeJsonFileSync = (
  filePath: string,
  data: unknown,
  mode: number = DEFAULT_FILE_MODE
): void => {
  const dir = path.dirname(filePath);
  ensureDirSync(dir, DEFAULT_DIR_MODE);

  const tempPath = `${filePath}.${randomUUID()}.tmp`;
  const content = `${JSON.stringify(data, null, 2)}\n`;

  fs.writeFileSync(tempPath, content, { mode });
  fs.renameSync(tempPath, filePath);
};

const listJsonFilesSync = (dirPath: string): string[] => {
  try {
    return fs
      .readdirSync(dirPath)
      .filter((name) => name.endsWith(".json"))
      .map((name) => path.join(dirPath, name));
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return [];
    }

    throw error;
  }
};

const removeFileSync = (filePath: string): boolean => {
  try {
    fs.unlinkSync(filePath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return false;
    }

    throw error;
  }
};

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
