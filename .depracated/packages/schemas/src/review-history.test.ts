import { describe, it, expect } from "vitest";
import {
  ReviewHistoryMetadataSchema,
  ReviewGitContextSchema,
  SavedReviewSchema,
} from "./review-history.js";
import { createReviewHistoryMetadata as createBaseMetadata } from "../__test__/testing.js";

describe("ReviewHistoryMetadataSchema", () => {
  it("accepts valid metadata with all fields", () => {
    const metadata = createBaseMetadata({
      issueCount: 5,
      criticalCount: 1,
      warningCount: 2,
    });
    const result = ReviewHistoryMetadataSchema.safeParse(metadata);
    expect(result.success).toBe(true);
  });

  it.each([
    ["overallScore below 0", { overallScore: -1 }],
    ["overallScore above 10", { overallScore: 11 }],
    ["negative issueCount", { issueCount: -1 }],
    ["invalid id (not a UUID)", { id: "not-a-uuid" }],
  ])("rejects %s", (_, overrides) => {
    const result = ReviewHistoryMetadataSchema.safeParse(createBaseMetadata(overrides));
    expect(result.success).toBe(false);
  });
});

describe("ReviewGitContextSchema", () => {
  it("accepts valid git context", () => {
    const result = ReviewGitContextSchema.safeParse({ branch: "main", fileCount: 5 });
    expect(result.success).toBe(true);
  });

  it.each([
    ["negative fileCount", { branch: "main", fileCount: -1 }],
    ["non-integer fileCount", { branch: "main", fileCount: 2.5 }],
  ])("rejects %s", (_, context) => {
    const result = ReviewGitContextSchema.safeParse(context);
    expect(result.success).toBe(false);
  });
});

describe("SavedReviewSchema", () => {
  const createIssue = (severity: string, category = "style") => ({
    severity,
    category,
    file: "test.ts",
    line: 10,
    title: "Test issue",
    description: "Test description",
    suggestion: null,
  });

  function createResult(overrides: { summary?: string; issues?: ReturnType<typeof createIssue>[]; overallScore?: number } = {}) {
    return {
      summary: "Good code overall",
      issues: [createIssue("warning")],
      overallScore: 8,
      ...overrides,
    };
  }

  function createSavedReview(overrides: { metadata?: ReturnType<typeof createBaseMetadata>; result?: ReturnType<typeof createResult>; gitContext?: { branch: string | null; fileCount: number } } = {}) {
    return {
      metadata: overrides.metadata ?? createBaseMetadata({ issueCount: 1, warningCount: 1 }),
      result: overrides.result ?? createResult(),
      gitContext: overrides.gitContext ?? { branch: "main", fileCount: 1 },
    };
  }

  it("accepts valid saved review", () => {
    const result = SavedReviewSchema.safeParse(createSavedReview());
    expect(result.success).toBe(true);
  });

  it("rejects review with invalid metadata", () => {
    const savedReview = createSavedReview({
      metadata: createBaseMetadata({ id: "not-a-uuid", issueCount: 1, warningCount: 1 }),
    });
    const result = SavedReviewSchema.safeParse(savedReview);
    expect(result.success).toBe(false);
  });

  describe("metadata count validation", () => {
    it.each([
      ["issueCount", { issueCount: 5, criticalCount: 1, warningCount: 1 }],
      ["criticalCount", { issueCount: 2, criticalCount: 0, warningCount: 1 }],
      ["warningCount", { issueCount: 2, criticalCount: 1, warningCount: 0 }],
    ])("rejects when %s does not match actual issues", (_, metadataOverrides) => {
      const savedReview = createSavedReview({
        metadata: createBaseMetadata(metadataOverrides),
        result: createResult({
          summary: "Test",
          issues: [createIssue("critical"), createIssue("warning")],
        }),
      });
      const result = SavedReviewSchema.safeParse(savedReview);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toBe(
          "Metadata counts must match actual issue data"
        );
      }
    });

    it("accepts when all counts match exactly", () => {
      const savedReview = createSavedReview({
        metadata: createBaseMetadata({
          issueCount: 4,
          criticalCount: 1,
          warningCount: 2,
        }),
        result: createResult({
          summary: "Test",
          issues: [
            createIssue("critical"),
            createIssue("warning"),
            createIssue("warning"),
            createIssue("suggestion"),
          ],
        }),
      });
      const result = SavedReviewSchema.safeParse(savedReview);
      expect(result.success).toBe(true);
    });

    it("accepts when all counts are zero with empty issues array", () => {
      const savedReview = createSavedReview({
        metadata: createBaseMetadata({
          issueCount: 0,
          criticalCount: 0,
          warningCount: 0,
        }),
        result: createResult({
          summary: "Perfect!",
          issues: [],
        }),
      });
      const result = SavedReviewSchema.safeParse(savedReview);
      expect(result.success).toBe(true);
    });
  });
});
