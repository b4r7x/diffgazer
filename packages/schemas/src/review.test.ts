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

function createValidIssue(overrides = {}) {
  return {
    severity: "warning",
    category: "logic",
    file: "src/index.ts",
    line: 42,
    title: "Test Issue",
    description: "This is a test issue description",
    suggestion: "Consider fixing this",
    ...overrides,
  };
}

describe("ScoreSchema", () => {
  it.each([0, 5, 10, 7.5, null])("accepts valid score: %s", (score) => {
    expect(ScoreSchema.safeParse(score).success).toBe(true);
  });

  it.each([-1, -0.1, 11, 10.1])("rejects out-of-range score: %s", (score) => {
    expect(ScoreSchema.safeParse(score).success).toBe(false);
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
  it("accepts valid issue with all fields", () => {
    expect(ReviewIssueSchema.safeParse(createValidIssue()).success).toBe(true);
  });

  it.each([
    { file: "src/app.ts", line: 100 },
    { file: "src/app.ts", line: null },
    { file: null, line: null },
    { suggestion: null },
  ])("accepts issue with %o", (overrides) => {
    expect(ReviewIssueSchema.safeParse(createValidIssue(overrides)).success).toBe(true);
  });

  it("rejects issue with line but no file", () => {
    const result = ReviewIssueSchema.safeParse(createValidIssue({ file: null, line: 42 }));
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Line number requires a file to be specified");
  });

  it("rejects issue with missing required fields", () => {
    expect(ReviewIssueSchema.safeParse({ severity: "warning", category: "logic" }).success).toBe(false);
  });

  it.each([{ severity: "invalid" }, { category: "invalid" }])("rejects issue with %o", (overrides) => {
    expect(ReviewIssueSchema.safeParse(createValidIssue(overrides)).success).toBe(false);
  });
});

describe("ReviewResultSchema", () => {
  it("accepts valid result with issues", () => {
    const result = ReviewResultSchema.safeParse({
      summary: "Code review completed",
      issues: [createValidIssue()],
      overallScore: 8,
    });
    expect(result.success).toBe(true);
  });

  it.each([
    { summary: "No issues found", issues: [], overallScore: 10 },
    { summary: "Review completed", issues: [], overallScore: null },
  ])("accepts result: %o", (data) => {
    expect(ReviewResultSchema.safeParse(data).success).toBe(true);
  });

  it("rejects result with invalid issue", () => {
    const result = ReviewResultSchema.safeParse({
      summary: "Review completed",
      issues: [createValidIssue({ file: null, line: 42 })],
      overallScore: 5,
    });
    expect(result.success).toBe(false);
  });

  it("rejects result with overallScore out of range", () => {
    const result = ReviewResultSchema.safeParse({
      summary: "Review completed",
      issues: [],
      overallScore: 15,
    });
    expect(result.success).toBe(false);
  });
});

describe("FileReviewResultSchema", () => {
  it("accepts valid file review result", () => {
    const result = FileReviewResultSchema.safeParse({
      filePath: "src/index.ts",
      summary: "File review completed",
      issues: [createValidIssue()],
      score: 7,
    });
    expect(result.success).toBe(true);
  });

  it("accepts file review result with parseError flag", () => {
    const result = FileReviewResultSchema.safeParse({
      filePath: "src/index.ts",
      summary: "Raw AI output here",
      issues: [],
      score: null,
      parseError: true,
      parseErrorMessage: "Invalid JSON response",
    });
    expect(result.success).toBe(true);
  });

  it("rejects file review result with invalid issue", () => {
    const result = FileReviewResultSchema.safeParse({
      filePath: "src/index.ts",
      summary: "File review completed",
      issues: [createValidIssue({ file: null, line: 42 })],
      score: 5,
    });
    expect(result.success).toBe(false);
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
  it("accepts valid error", () => {
    expect(ReviewErrorSchema.safeParse({ message: "No diff found", code: "NO_DIFF" }).success).toBe(true);
  });

  it.each([{ code: "NO_DIFF" }, { message: "Error message" }])("rejects incomplete error: %o", (data) => {
    expect(ReviewErrorSchema.safeParse(data).success).toBe(false);
  });
});

describe("ReviewStreamEventSchema", () => {
  it("accepts valid chunk event", () => {
    const result = ReviewStreamEventSchema.safeParse({
      type: "chunk",
      content: "Some streaming content",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid complete event", () => {
    const result = ReviewStreamEventSchema.safeParse({
      type: "complete",
      result: { summary: "Review completed", issues: [], overallScore: 8 },
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid error event", () => {
    const result = ReviewStreamEventSchema.safeParse({
      type: "error",
      error: { message: "AI service unavailable", code: "AI_ERROR" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects event with invalid type", () => {
    const result = ReviewStreamEventSchema.safeParse({ type: "invalid", data: "some data" });
    expect(result.success).toBe(false);
  });

  it("rejects complete event with invalid issue", () => {
    const result = ReviewStreamEventSchema.safeParse({
      type: "complete",
      result: {
        summary: "Review completed",
        issues: [createValidIssue({ file: null, line: 42 })],
        overallScore: 8,
      },
    });
    expect(result.success).toBe(false);
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
