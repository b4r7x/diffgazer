import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createStorageTestContext, createPathsMock, unwrap, delay } from "../../__test__/testing.js";
import type { ReviewResult } from "@repo/schemas/review";
import type { ReviewGitContext } from "@repo/schemas/review-history";

const mocks = vi.hoisted(() => ({ testDir: "" }));

vi.mock("./paths.js", async () => ({
  get paths() {
    return createPathsMock(mocks);
  },
}));

let saveReview: typeof import("./review-history.js").saveReview;
let listReviews: typeof import("./review-history.js").listReviews;
let reviewStore: typeof import("./review-history.js").reviewStore;

const mockResult: ReviewResult = {
  summary: "Test review summary",
  issues: [{ severity: "warning", category: "style", file: "test.ts", line: 10, title: "Test issue", description: "Desc", suggestion: null }],
  overallScore: 8,
};

const mockGitContext: ReviewGitContext = { branch: "main", fileCount: 1 };

const emptyResult: ReviewResult = { summary: "Test", issues: [], overallScore: null };
const emptyGitContext: ReviewGitContext = { branch: null, fileCount: 0 };

describe("Review History Storage", () => {
  let cleanup: () => Promise<void>;

  beforeEach(async () => {
    const context = await createStorageTestContext("reviews");
    mocks.testDir = context.testDir;
    cleanup = context.cleanup;

    vi.resetModules();
    ({ saveReview, listReviews, reviewStore } = await import("./review-history.js"));
  });

  afterEach(async () => {
    vi.clearAllMocks();
    await cleanup();
  });

  describe("saveReview", () => {
    it("counts issues by severity correctly", async () => {
      const issue = (severity: string) => ({ severity, category: "test", file: null, line: null, title: severity, description: "Desc", suggestion: null });
      const result: ReviewResult = {
        summary: "Test",
        issues: [issue("critical"), issue("critical"), issue("warning"), issue("suggestion")] as ReviewResult["issues"],
        overallScore: 5,
      };

      const review = unwrap(await saveReview("/test", true, result, mockGitContext));
      expect(review.issueCount).toBe(4);
      expect(review.criticalCount).toBe(2);
      expect(review.warningCount).toBe(1);
    });

    it("persists and retrieves review data", async () => {
      const saved = unwrap(await saveReview("/test", true, mockResult, mockGitContext));
      const read = unwrap(await reviewStore.read(saved.id));

      expect(read.result.summary).toBe("Test review summary");
      expect(read.result.issues).toHaveLength(1);
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
      await delay(10);
      await saveReview("/project", true, { ...emptyResult, summary: "Second" }, emptyGitContext);

      const list = unwrap(await listReviews("/project"));
      expect(list.items).toHaveLength(2);

      const [first, second] = list.items;
      expect(new Date(first!.createdAt).getTime()).toBeGreaterThan(new Date(second!.createdAt).getTime());
    });
  });

  describe("reviewStore.remove", () => {
    it("removes review from store and list", async () => {
      const review1 = unwrap(await saveReview("/project", true, emptyResult, emptyGitContext));
      const review2 = unwrap(await saveReview("/project", true, emptyResult, emptyGitContext));

      const removeResult = await reviewStore.remove(review1.id);
      expect(removeResult.ok).toBe(true);

      const readResult = await reviewStore.read(review1.id);
      expect(readResult.ok).toBe(false);

      const list = unwrap(await listReviews("/project"));
      expect(list.items).toHaveLength(1);
      expect(list.items[0]!.id).toBe(review2.id);
    });
  });
});
