import { describe, it, expect } from "vitest";
import {
  REVIEW_SEVERITY,
  REVIEW_CATEGORY,
  ReviewSeveritySchema,
  ReviewCategorySchema,
  ReviewIssueSchema,
  ReviewResultSchema,
  FileReviewResultSchema,
  ReviewErrorCodeSchema,
  ReviewErrorSchema,
  ReviewStreamEventSchema,
  ScoreSchema,
} from "./review.js";
import { createValidIssue } from "../__test__/testing.js";

describe("ScoreSchema", () => {
  it.each([
    [0, true],
    [5, true],
    [10, true],
    [7.5, true],
    [null, true],
    [-1, false],
    [-0.1, false],
    [11, false],
    [10.1, false],
  ])("validates score %s as %s", (score, expected) => {
    expect(ScoreSchema.safeParse(score).success).toBe(expected);
  });
});

describe("ReviewSeveritySchema", () => {
  it.each(REVIEW_SEVERITY)("accepts valid severity: %s", (severity) => {
    expect(ReviewSeveritySchema.safeParse(severity).success).toBe(true);
  });

  it.each(["error", "info", "high", "low", ""])("rejects invalid severity: %s", (severity) => {
    expect(ReviewSeveritySchema.safeParse(severity).success).toBe(false);
  });
});

describe("ReviewCategorySchema", () => {
  it.each(REVIEW_CATEGORY)("accepts valid category: %s", (category) => {
    expect(ReviewCategorySchema.safeParse(category).success).toBe(true);
  });

  it.each(["bug", "feature", "refactor", "test", ""])("rejects invalid category: %s", (category) => {
    expect(ReviewCategorySchema.safeParse(category).success).toBe(false);
  });
});

describe("ReviewIssueSchema", () => {
  it.each([
    [{}, true],
    [{ file: "src/app.ts", line: 100 }, true],
    [{ file: "src/app.ts", line: null }, true],
    [{ file: null, line: null }, true],
    [{ suggestion: null }, true],
    [{ file: null, line: 42 }, false],
    [{ severity: "invalid" }, false],
    [{ category: "invalid" }, false],
  ])("validates issue with %o as %s", (overrides, expected) => {
    expect(ReviewIssueSchema.safeParse(createValidIssue(overrides)).success).toBe(expected);
  });

  it("provides correct error message for line without file", () => {
    const result = ReviewIssueSchema.safeParse(createValidIssue({ file: null, line: 42 }));
    expect(result.error?.issues[0]?.message).toBe("Line number requires a file to be specified");
  });

  it("rejects issue with missing required fields", () => {
    expect(ReviewIssueSchema.safeParse({ severity: "warning", category: "logic" }).success).toBe(false);
  });
});

describe("ReviewResultSchema", () => {
  it.each([
    [{ summary: "Code review completed", issues: [createValidIssue()], overallScore: 8 }, true],
    [{ summary: "No issues found", issues: [], overallScore: 10 }, true],
    [{ summary: "Review completed", issues: [], overallScore: null }, true],
    [{ summary: "Review", issues: [createValidIssue({ file: null, line: 42 })], overallScore: 5 }, false],
    [{ summary: "Review", issues: [], overallScore: 15 }, false],
  ])("validates result %o as %s", (data, expected) => {
    expect(ReviewResultSchema.safeParse(data).success).toBe(expected);
  });
});

describe("FileReviewResultSchema", () => {
  it.each([
    [{ filePath: "src/index.ts", summary: "File review completed", issues: [createValidIssue()], score: 7 }, true],
    [{ filePath: "src/index.ts", summary: "Raw AI output", issues: [], score: null, parseError: true, parseErrorMessage: "Invalid JSON" }, true],
    [{ filePath: "src/index.ts", summary: "File review", issues: [createValidIssue({ file: null, line: 42 })], score: 5 }, false],
  ])("validates file review result %o as %s", (data, expected) => {
    expect(FileReviewResultSchema.safeParse(data).success).toBe(expected);
  });
});

describe("ReviewErrorCodeSchema", () => {
  it.each(["NO_DIFF", "AI_ERROR", "INTERNAL_ERROR", "API_KEY_MISSING", "RATE_LIMITED"] as const)(
    "accepts valid error code: %s",
    (code) => {
      expect(ReviewErrorCodeSchema.safeParse(code).success).toBe(true);
    }
  );

  it.each(["UNKNOWN", "INVALID_CODE", ""])("rejects invalid error code: %s", (code) => {
    expect(ReviewErrorCodeSchema.safeParse(code).success).toBe(false);
  });
});

describe("ReviewErrorSchema", () => {
  it.each([
    [{ message: "No diff found", code: "NO_DIFF" }, true],
    [{ code: "NO_DIFF" }, false],
    [{ message: "Error message" }, false],
  ])("validates error %o as %s", (data, expected) => {
    expect(ReviewErrorSchema.safeParse(data).success).toBe(expected);
  });
});

describe("ReviewStreamEventSchema", () => {
  it.each([
    ["chunk", { type: "chunk", content: "Some streaming content" }, true],
    ["complete", { type: "complete", result: { summary: "Review completed", issues: [], overallScore: 8 } }, true],
    ["error", { type: "error", error: { message: "AI service unavailable", code: "AI_ERROR" } }, true],
    ["invalid type", { type: "invalid", data: "some data" }, false],
    ["invalid nested issue", { type: "complete", result: { summary: "Review", issues: [createValidIssue({ file: null, line: 42 })], overallScore: 8 } }, false],
  ])("validates %s event as %s", (_label, data, expected) => {
    expect(ReviewStreamEventSchema.safeParse(data).success).toBe(expected);
  });

  it("strips extra fields from events", () => {
    const result = ReviewStreamEventSchema.safeParse({
      type: "complete",
      result: { summary: "Review completed", issues: [], overallScore: 8 },
      extraField: "should be stripped",
    });
    expect(result.success).toBe(true);
    expect("extraField" in result.data!).toBe(false);
  });
});
