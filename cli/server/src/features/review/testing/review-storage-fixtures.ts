import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SavedReview } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { CURSOR_INDEX_MARKER, projectHash } from "../storage/project-index.js";

export { CURSOR_INDEX_MARKER };

export const REVIEW_ID = "550e8400-e29b-41d4-a716-446655440000";
export const REVIEW_ID_2 = "660e8400-e29b-41d4-a716-446655440001";

export const makeReviewId = (value: number): string =>
  `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;

export interface ProjectIndexEntry {
  id: string;
  createdAt: string;
}

export const makeSavedReview = (overrides: Partial<SavedReview> = {}): SavedReview => ({
  metadata: {
    id: REVIEW_ID,
    projectPath: "/projects/test",
    createdAt: "2025-01-01T00:00:00.000Z",
    mode: "unstaged",
    branch: "main",
    profile: null,
    lenses: ["correctness"],
    issueCount: 2,
    failedLensCount: 0,
    blockerCount: 0,
    highCount: 1,
    mediumCount: 1,
    lowCount: 0,
    nitCount: 0,
    fileCount: 3,
  },
  result: {
    issues: [
      makeIssue({ id: "i1", title: "Bug", severity: "high", file: "a.ts" }),
      makeIssue({
        id: "i2",
        title: "Warn",
        severity: "medium",
        file: "b.ts",
        line_start: 5,
        line_end: 6,
      }),
    ],
  },
  gitContext: {
    branch: "main",
    commit: "abc123",
    fileCount: 3,
    additions: 10,
    deletions: 5,
  },
  ...overrides,
});

export function makeProjectReview(
  id: string,
  createdAt: string,
  projectPath = "/proj/a",
): SavedReview {
  const review = makeSavedReview();
  return {
    ...review,
    metadata: { ...review.metadata, id, createdAt, projectPath },
  };
}

/**
 * Filesystem helpers for the review-store layout under a per-test DIFFGAZER_HOME.
 * `homeDir` is read on every call so a suite can point it at the temp directory
 * its own `beforeEach` just created.
 */
export function reviewStorageFixtures(homeDir: () => string) {
  const reviewsDir = (): string => join(homeDir(), "triage-reviews");
  const reviewPath = (id: string): string => join(reviewsDir(), `${id}.json`);
  // The hash comes from production, so a derivation change cannot leave these
  // helpers writing to a filename production never reads. The join is rebuilt
  // here because `homeDir()` moves per suite while production's REVIEWS_DIR is
  // fixed at import time.
  const projectIndexPath = (projectPath: string): string =>
    join(reviewsDir(), ".index", `${projectHash(projectPath)}.json`);
  const projectReconcileMarkerPath = (projectPath: string): string =>
    join(reviewsDir(), ".index", `${projectHash(projectPath)}.reconcile`);
  const projectCursorMarkerPath = (projectPath: string): string =>
    join(reviewsDir(), ".index", `${projectHash(projectPath)}.cursor-v1`);

  async function readJson<T>(filePath: string): Promise<T> {
    return JSON.parse(await readFile(filePath, "utf-8")) as T;
  }

  async function writeSavedReview(review: SavedReview): Promise<void> {
    await mkdir(reviewsDir(), { recursive: true });
    await writeFile(
      reviewPath(review.metadata.id),
      `${JSON.stringify(review, null, 2)}\n`,
      "utf-8",
    );
  }

  async function readSavedReview(id: string): Promise<SavedReview> {
    return readJson<SavedReview>(reviewPath(id));
  }

  async function writeProjectIndexFile(projectPath: string, ids: string[]): Promise<void> {
    await mkdir(join(reviewsDir(), ".index"), { recursive: true });
    await writeFile(projectIndexPath(projectPath), JSON.stringify(ids), "utf-8");
  }

  async function readProjectIndexIds(projectPath: string): Promise<string[]> {
    const entries = await readJson<Array<string | ProjectIndexEntry>>(
      projectIndexPath(projectPath),
    );
    return entries.map((entry) => (typeof entry === "string" ? entry : entry.id));
  }

  async function writeCertifiedProjectIndex(
    projectPath: string,
    entries: ProjectIndexEntry[],
  ): Promise<void> {
    await mkdir(join(reviewsDir(), ".index"), { recursive: true });
    await writeFile(projectIndexPath(projectPath), JSON.stringify(entries), "utf-8");
    await writeFile(projectCursorMarkerPath(projectPath), CURSOR_INDEX_MARKER, "utf-8");
  }

  async function writeReconcileMarker(projectPath: string): Promise<void> {
    await mkdir(join(reviewsDir(), ".index"), { recursive: true });
    await writeFile(projectReconcileMarkerPath(projectPath), "", "utf-8");
  }

  return {
    reviewsDir,
    reviewPath,
    projectIndexPath,
    projectReconcileMarkerPath,
    projectCursorMarkerPath,
    readJson,
    writeSavedReview,
    readSavedReview,
    writeProjectIndexFile,
    readProjectIndexIds,
    writeCertifiedProjectIndex,
    writeReconcileMarker,
  };
}
