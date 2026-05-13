import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROJECT_ROOT_HEADER } from "../../shared/lib/paths.js";
import { makeIssue } from "../../shared/lib/testing/factories.js";

const REVIEW_A = "550e8400-e29b-41d4-a716-446655440000";
const REVIEW_B = "660e8400-e29b-41d4-a716-446655440001";

let tempHome: string;
let projectA: string;
let projectB: string;

beforeEach(async () => {
  tempHome = await mkdtemp(join(tmpdir(), "diffgazer-review-router-home-"));
  projectA = await mkdtemp(join(tmpdir(), "diffgazer-review-router-a-"));
  projectB = await mkdtemp(join(tmpdir(), "diffgazer-review-router-b-"));
  await mkdir(join(projectA, ".git"));
  await mkdir(join(projectB, ".git"));
  process.env.DIFFGAZER_HOME = tempHome;
  vi.resetModules();
});

afterEach(async () => {
  delete process.env.DIFFGAZER_HOME;
  await rm(tempHome, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
  await rm(projectA, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
  await rm(projectB, { recursive: true, force: true, maxRetries: 3, retryDelay: 20 });
});

async function createReviewApp(): Promise<Hono> {
  const { reviewRouter } = await import("./router.js");
  return new Hono().route("/api/review", reviewRouter);
}

async function trustProject(projectRoot: string): Promise<void> {
  const { getProjectInfo, saveTrust } = await import("../../shared/lib/config/store.js");
  const project = getProjectInfo(projectRoot);
  saveTrust({
    projectId: project.projectId,
    repoRoot: projectRoot,
    trustedAt: "2024-01-01T00:00:00.000Z",
    capabilities: { readFiles: true, runCommands: false },
    trustMode: "persistent",
  });
}

async function saveReview(reviewId: string, projectPath: string): Promise<void> {
  const { saveReview: saveStoredReview } = await import("../../shared/lib/storage/reviews.js");
  const result = await saveStoredReview({
    reviewId,
    projectPath,
    mode: "unstaged",
    branch: "main",
    commit: "abc123",
    lenses: ["correctness"],
    diff: {
      totalStats: { filesChanged: 1, additions: 1, deletions: 0, totalSizeBytes: 100 },
      files: [],
    },
    result: {
      summary: "summary",
      issues: [makeIssue({ id: `${reviewId}-issue` })],
    },
  });
  expect(result.ok).toBe(true);
}

function requestOptions(projectRoot: string): RequestInit {
  return { headers: { [PROJECT_ROOT_HEADER]: projectRoot } };
}

describe("review router project boundaries", () => {
  it("lists reviews when the query project matches the trusted request project", async () => {
    await trustProject(projectA);
    await saveReview(REVIEW_A, projectA);
    await saveReview(REVIEW_B, projectB);
    const app = await createReviewApp();

    const response = await app.request(
      `/api/review/reviews?projectPath=${encodeURIComponent(projectA)}`,
      requestOptions(projectA),
    );
    const body = await response.json() as { reviews: Array<{ id: string }> };

    expect(response.status).toBe(200);
    expect(body.reviews.map((review) => review.id)).toEqual([REVIEW_A]);
  });

  it("rejects a review list query for a different project", async () => {
    await trustProject(projectA);
    await saveReview(REVIEW_A, projectA);
    await saveReview(REVIEW_B, projectB);
    const app = await createReviewApp();

    const response = await app.request(
      `/api/review/reviews?projectPath=${encodeURIComponent(projectB)}`,
      requestOptions(projectA),
    );

    expect(response.status).toBe(400);
  });

  it("does not read or delete reviews from another project", async () => {
    await trustProject(projectA);
    await saveReview(REVIEW_B, projectB);
    const app = await createReviewApp();

    const readResponse = await app.request(
      `/api/review/reviews/${REVIEW_B}`,
      requestOptions(projectA),
    );
    expect(readResponse.status).toBe(404);

    const deleteResponse = await app.request(
      `/api/review/reviews/${REVIEW_B}`,
      { ...requestOptions(projectA), method: "DELETE" },
    );
    expect(deleteResponse.status).toBe(200);
    await expect(deleteResponse.json()).resolves.toEqual({ existed: false });

    const { getReview } = await import("../../shared/lib/storage/reviews.js");
    const stored = await getReview(REVIEW_B);
    expect(stored.ok).toBe(true);
  });

  it("keeps review deletion idempotent when a review does not exist", async () => {
    await trustProject(projectA);
    const app = await createReviewApp();

    const response = await app.request(
      `/api/review/reviews/${REVIEW_A}`,
      { ...requestOptions(projectA), method: "DELETE" },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ existed: false });
  });
});
