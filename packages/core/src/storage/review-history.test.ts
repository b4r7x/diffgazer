import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp, rm, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ReviewResult } from "@repo/schemas/review";
import type { ReviewGitContext } from "@repo/schemas/review-history";

const mocks = vi.hoisted(() => ({
  testDir: "" as string,
}));

vi.mock("./paths.js", async () => ({
  get paths() {
    return {
      reviews: join(mocks.testDir, "reviews"),
      sessions: join(mocks.testDir, "sessions"),
      sessionFile: (id: string) => join(mocks.testDir, "sessions", `${id}.json`),
      reviewFile: (id: string) => join(mocks.testDir, "reviews", `${id}.json`),
      config: mocks.testDir,
      configFile: join(mocks.testDir, "config.json"),
      secretsDir: join(mocks.testDir, "secrets"),
      secretsFile: join(mocks.testDir, "secrets", "secrets.json"),
      appHome: mocks.testDir,
    };
  },
}));

// We must dynamically import the stores after the mock is set up, and reset modules each test
let saveReview: typeof import("./review-history.js").saveReview;
let listReviews: typeof import("./review-history.js").listReviews;
let deleteReview: typeof import("./review-history.js").deleteReview;
let reviewStore: typeof import("./review-history.js").reviewStore;

// Helper to unwrap successful results
function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(`Expected successful result, got error: ${JSON.stringify(result.error)}`);
  return result.value;
}

// Shared test fixtures
const mockResult: ReviewResult = {
  summary: "Test review summary",
  issues: [
    {
      severity: "warning",
      category: "style",
      file: "test.ts",
      line: 10,
      title: "Test issue",
      description: "Test description",
      suggestion: null,
    },
  ],
  overallScore: 8,
};

const mockGitContext: ReviewGitContext = {
  branch: "main",
  fileCount: 1,
};

const emptyResult: ReviewResult = { summary: "Test", issues: [], overallScore: null };
const emptyGitContext: ReviewGitContext = { branch: null, fileCount: 0 };

// UUID v4 regex pattern
const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("Review History Storage", () => {
  beforeEach(async () => {
    mocks.testDir = await mkdtemp(join(tmpdir(), "stargazer-test-reviews-"));
    await mkdir(join(mocks.testDir, "reviews"), { recursive: true });
    await mkdir(join(mocks.testDir, "sessions"), { recursive: true });

    // Reset modules to pick up new testDir value
    vi.resetModules();
    const mod = await import("./review-history.js");
    saveReview = mod.saveReview;
    listReviews = mod.listReviews;
    deleteReview = mod.deleteReview;
    reviewStore = mod.reviewStore;
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await rm(mocks.testDir, { recursive: true, force: true });
  });

  describe("saveReview", () => {
    it("counts issues by severity correctly", async () => {
      const resultWithMultiple: ReviewResult = {
        summary: "Test",
        issues: [
          { severity: "critical", category: "security", file: null, line: null, title: "Critical 1", description: "Desc", suggestion: null },
          { severity: "critical", category: "logic", file: null, line: null, title: "Critical 2", description: "Desc", suggestion: null },
          { severity: "warning", category: "style", file: null, line: null, title: "Warning", description: "Desc", suggestion: null },
          { severity: "suggestion", category: "performance", file: null, line: null, title: "Suggestion", description: "Desc", suggestion: null },
        ],
        overallScore: 5,
      };

      const review = unwrap(await saveReview("/test", true, resultWithMultiple, mockGitContext));

      expect(review.issueCount).toBe(4);
      expect(review.criticalCount).toBe(2);
      expect(review.warningCount).toBe(1);
    });

    it("handles empty issues array", async () => {
      const resultNoIssues: ReviewResult = { summary: "Perfect code!", issues: [], overallScore: 10 };
      const review = unwrap(await saveReview("/test", true, resultNoIssues, mockGitContext));

      expect(review.issueCount).toBe(0);
      expect(review.criticalCount).toBe(0);
      expect(review.warningCount).toBe(0);
    });

    it("can read back saved review", async () => {
      const saved = unwrap(await saveReview("/test", true, mockResult, mockGitContext));
      const read = unwrap(await reviewStore.read(saved.id));

      expect(read.result.summary).toBe("Test review summary");
      expect(read.result.issues).toHaveLength(1);
    });

    it("generates valid UUID", async () => {
      const review = unwrap(await saveReview("/test", true, mockResult, mockGitContext));
      expect(review.id).toMatch(UUID_V4_PATTERN);
    });
  });

  describe("listReviews", () => {
    it("lists reviews for project", async () => {
      await saveReview("/project/a", true, emptyResult, emptyGitContext);
      await saveReview("/project/b", true, emptyResult, emptyGitContext);
      await saveReview("/project/a", false, emptyResult, emptyGitContext);

      const list = unwrap(await listReviews("/project/a"));
      expect(list.items).toHaveLength(2);
    });

    it("returns all reviews when no filter", async () => {
      await saveReview("/project/a", true, emptyResult, emptyGitContext);
      await saveReview("/project/b", true, emptyResult, emptyGitContext);

      const list = unwrap(await listReviews());
      expect(list.items).toHaveLength(2);
    });

    it("returns empty array for no reviews", async () => {
      const list = unwrap(await listReviews("/nonexistent"));
      expect(list.items).toEqual([]);
    });

    it("sorts by createdAt descending", async () => {
      await saveReview("/project", true, { ...emptyResult, summary: "First" }, emptyGitContext);
      await new Promise((r) => setTimeout(r, 10));
      await saveReview("/project", true, { ...emptyResult, summary: "Second" }, emptyGitContext);

      const list = unwrap(await listReviews("/project"));
      expect(list.items).toHaveLength(2);

      const [first, second] = list.items;
      expect(new Date(first!.createdAt).getTime()).toBeGreaterThan(new Date(second!.createdAt).getTime());
    });
  });

  describe("deleteReview", () => {
    it("deletes existing review", async () => {
      const review = unwrap(await saveReview("/test", true, emptyResult, emptyGitContext));
      const deleteResult = await deleteReview(review.id);

      expect(deleteResult.ok).toBe(true);

      const readResult = await reviewStore.read(review.id);
      expect(readResult.ok).toBe(false);
    });

    it("removes review from list", async () => {
      const review1 = unwrap(await saveReview("/project", true, emptyResult, emptyGitContext));
      const review2 = unwrap(await saveReview("/project", true, emptyResult, emptyGitContext));

      await deleteReview(review1.id);

      const list = unwrap(await listReviews("/project"));
      expect(list.items).toHaveLength(1);
      expect(list.items[0]!.id).toBe(review2.id);
    });
  });
});
