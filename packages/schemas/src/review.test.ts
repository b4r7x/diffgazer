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

describe("ScoreSchema", () => {
  it("accepts valid scores within range", () => {
    expect(ScoreSchema.safeParse(0).success).toBe(true);
    expect(ScoreSchema.safeParse(5).success).toBe(true);
    expect(ScoreSchema.safeParse(10).success).toBe(true);
    expect(ScoreSchema.safeParse(7.5).success).toBe(true);
  });

  it("accepts null", () => {
    expect(ScoreSchema.safeParse(null).success).toBe(true);
  });

  it("rejects scores below 0", () => {
    expect(ScoreSchema.safeParse(-1).success).toBe(false);
    expect(ScoreSchema.safeParse(-0.1).success).toBe(false);
  });

  it("rejects scores above 10", () => {
    expect(ScoreSchema.safeParse(11).success).toBe(false);
    expect(ScoreSchema.safeParse(10.1).success).toBe(false);
  });
});

describe("ReviewSeveritySchema", () => {
  it.each(REVIEW_SEVERITY)("accepts valid severity: %s", (severity) => {
    const result = ReviewSeveritySchema.safeParse(severity);
    expect(result.success).toBe(true);
  });

  it.each(["error", "info", "high", "low", ""])(
    "rejects invalid severity: %s",
    (severity) => {
      const result = ReviewSeveritySchema.safeParse(severity);
      expect(result.success).toBe(false);
    }
  );
});

describe("ReviewCategorySchema", () => {
  it.each(REVIEW_CATEGORY)("accepts valid category: %s", (category) => {
    const result = ReviewCategorySchema.safeParse(category);
    expect(result.success).toBe(true);
  });

  it.each(["bug", "feature", "refactor", "test", ""])(
    "rejects invalid category: %s",
    (category) => {
      const result = ReviewCategorySchema.safeParse(category);
      expect(result.success).toBe(false);
    }
  );
});

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

describe("ReviewIssueSchema", () => {
  it("accepts valid issue with all fields", () => {
    const result = ReviewIssueSchema.safeParse(createValidIssue());
    expect(result.success).toBe(true);
  });

  it("accepts issue with file and line both specified", () => {
    const result = ReviewIssueSchema.safeParse(
      createValidIssue({ file: "src/app.ts", line: 100 })
    );
    expect(result.success).toBe(true);
  });

  it("accepts issue with file specified and line null", () => {
    const result = ReviewIssueSchema.safeParse(
      createValidIssue({ file: "src/app.ts", line: null })
    );
    expect(result.success).toBe(true);
  });

  it("accepts issue with both file and line null (project-wide issue)", () => {
    const result = ReviewIssueSchema.safeParse(
      createValidIssue({ file: null, line: null })
    );
    expect(result.success).toBe(true);
  });

  it("accepts issue with null suggestion", () => {
    const result = ReviewIssueSchema.safeParse(
      createValidIssue({ suggestion: null })
    );
    expect(result.success).toBe(true);
  });

  describe("file/line relationship constraint", () => {
    it("rejects issue with line specified but file null", () => {
      const result = ReviewIssueSchema.safeParse(
        createValidIssue({ file: null, line: 42 })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].path).toContain("line");
        expect(result.error.issues[0].message).toBe(
          "Line number requires a file to be specified"
        );
      }
    });

    it("rejects issue with line 0 but file null", () => {
      const result = ReviewIssueSchema.safeParse(
        createValidIssue({ file: null, line: 0 })
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toBe(
          "Line number requires a file to be specified"
        );
      }
    });

    it("rejects issue with negative line but file null", () => {
      // Even invalid line numbers should trigger the constraint
      const result = ReviewIssueSchema.safeParse(
        createValidIssue({ file: null, line: -1 })
      );
      expect(result.success).toBe(false);
    });
  });

  it("rejects issue with missing required fields", () => {
    const result = ReviewIssueSchema.safeParse({
      severity: "warning",
      category: "logic",
    });
    expect(result.success).toBe(false);
  });

  it("rejects issue with invalid severity", () => {
    const result = ReviewIssueSchema.safeParse(
      createValidIssue({ severity: "invalid" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects issue with invalid category", () => {
    const result = ReviewIssueSchema.safeParse(
      createValidIssue({ category: "invalid" })
    );
    expect(result.success).toBe(false);
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

  it("accepts valid result with empty issues array", () => {
    const result = ReviewResultSchema.safeParse({
      summary: "No issues found",
      issues: [],
      overallScore: 10,
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid result with null overallScore", () => {
    const result = ReviewResultSchema.safeParse({
      summary: "Review completed",
      issues: [],
      overallScore: null,
    });
    expect(result.success).toBe(true);
  });

  it("rejects result with invalid issue in array", () => {
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

  it("accepts file review result without optional parseError fields", () => {
    const result = FileReviewResultSchema.safeParse({
      filePath: "src/index.ts",
      summary: "File review completed",
      issues: [],
      score: 8,
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
  it.each([
    "NO_DIFF",
    "AI_ERROR",
    "INTERNAL_ERROR",
    "API_KEY_MISSING",
    "RATE_LIMITED",
  ] as const)("accepts valid error code: %s", (code) => {
    const result = ReviewErrorCodeSchema.safeParse(code);
    expect(result.success).toBe(true);
  });

  it.each(["UNKNOWN", "INVALID_CODE", ""])(
    "rejects invalid error code: %s",
    (code) => {
      const result = ReviewErrorCodeSchema.safeParse(code);
      expect(result.success).toBe(false);
    }
  );
});

describe("ReviewErrorSchema", () => {
  it("accepts valid error", () => {
    const result = ReviewErrorSchema.safeParse({
      message: "No diff found",
      code: "NO_DIFF",
    });
    expect(result.success).toBe(true);
  });

  it("rejects error without message", () => {
    const result = ReviewErrorSchema.safeParse({
      code: "NO_DIFF",
    });
    expect(result.success).toBe(false);
  });

  it("rejects error without code", () => {
    const result = ReviewErrorSchema.safeParse({
      message: "Error message",
    });
    expect(result.success).toBe(false);
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
      result: {
        summary: "Review completed",
        issues: [],
        overallScore: 8,
      },
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid error event", () => {
    const result = ReviewStreamEventSchema.safeParse({
      type: "error",
      error: {
        message: "AI service unavailable",
        code: "AI_ERROR",
      },
    });
    expect(result.success).toBe(true);
  });

  it("rejects event with invalid type", () => {
    const result = ReviewStreamEventSchema.safeParse({
      type: "invalid",
      data: "some data",
    });
    expect(result.success).toBe(false);
  });

  it("rejects complete event with invalid issue in result", () => {
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
});
