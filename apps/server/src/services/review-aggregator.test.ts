import { describe, it, expect } from "vitest";
import { aggregateReviews } from "./review-aggregator.js";
import type { FileReviewResult, ReviewIssue } from "@repo/schemas/review";

function createIssue(overrides: Partial<ReviewIssue> = {}): ReviewIssue {
  return {
    severity: "warning",
    category: "style",
    file: "test.ts",
    line: 10,
    title: "Test Issue",
    description: "Test description",
    suggestion: null,
    ...overrides,
  };
}

function createFileResult(overrides: Partial<FileReviewResult> = {}): FileReviewResult {
  return {
    filePath: "test.ts",
    summary: "File reviewed successfully",
    issues: [],
    score: 8,
    parseError: false,
    ...overrides,
  };
}

describe("aggregateReviews", () => {
  describe("successful reviews without parse errors", () => {
    it("aggregates issues from all files", () => {
      const fileResults: FileReviewResult[] = [
        createFileResult({
          filePath: "file1.ts",
          issues: [createIssue({ file: "file1.ts" })],
        }),
        createFileResult({
          filePath: "file2.ts",
          issues: [createIssue({ file: "file2.ts" }), createIssue({ file: "file2.ts", severity: "critical" })],
        }),
      ];

      const result = aggregateReviews(fileResults, []);

      expect(result.result.issues).toHaveLength(3);
    });

    it("calculates average score from all files", () => {
      const fileResults: FileReviewResult[] = [
        createFileResult({ score: 8 }),
        createFileResult({ score: 6 }),
        createFileResult({ score: 10 }),
      ];

      const result = aggregateReviews(fileResults, []);

      expect(result.result.overallScore).toBe(8);
    });

    it("generates summary with file and issue counts", () => {
      const fileResults: FileReviewResult[] = [
        createFileResult({ issues: [createIssue()] }),
        createFileResult({ issues: [createIssue(), createIssue()] }),
      ];

      const result = aggregateReviews(fileResults, []);

      expect(result.result.summary).toContain("Reviewed 2 files");
      expect(result.result.summary).toContain("3 issues");
    });
  });

  describe("reviews with parse errors", () => {
    it("excludes issues from files with parse errors", () => {
      const fileResults: FileReviewResult[] = [
        createFileResult({
          filePath: "good.ts",
          issues: [createIssue({ file: "good.ts" })],
          parseError: false,
        }),
        createFileResult({
          filePath: "bad.ts",
          summary: "[Parse Error] AI response could not be parsed",
          issues: [],
          score: null,
          parseError: true,
          parseErrorMessage: "Unexpected token",
        }),
      ];

      const result = aggregateReviews(fileResults, []);

      expect(result.result.issues).toHaveLength(1);
      expect(result.result.issues[0]?.file).toBe("good.ts");
    });

    it("excludes scores from files with parse errors", () => {
      const fileResults: FileReviewResult[] = [
        createFileResult({ score: 8, parseError: false }),
        createFileResult({ score: null, parseError: true, parseErrorMessage: "Error" }),
      ];

      const result = aggregateReviews(fileResults, []);

      expect(result.result.overallScore).toBe(8);
    });

    it("shows WARNING in summary when parse errors occur", () => {
      const fileResults: FileReviewResult[] = [
        createFileResult({ parseError: false }),
        createFileResult({
          parseError: true,
          parseErrorMessage: "JSON parse error",
        }),
      ];

      const result = aggregateReviews(fileResults, []);

      expect(result.result.summary).toContain("WARNING");
      expect(result.result.summary).toContain("1 file");
      expect(result.result.summary).toContain("parsing errors");
      expect(result.result.summary).toContain("review may be incomplete");
    });

    it("shows plural warning for multiple parse errors", () => {
      const fileResults: FileReviewResult[] = [
        createFileResult({ parseError: true, parseErrorMessage: "Error 1" }),
        createFileResult({ parseError: true, parseErrorMessage: "Error 2" }),
        createFileResult({ parseError: true, parseErrorMessage: "Error 3" }),
      ];

      const result = aggregateReviews(fileResults, []);

      expect(result.result.summary).toContain("3 files");
      expect(result.result.summary).toContain("parsing errors");
    });

    it("counts only successful files in reviewed count", () => {
      const fileResults: FileReviewResult[] = [
        createFileResult({ parseError: false }),
        createFileResult({ parseError: false }),
        createFileResult({ parseError: true, parseErrorMessage: "Error" }),
      ];

      const result = aggregateReviews(fileResults, []);

      expect(result.result.summary).toContain("Reviewed 2 files");
    });

    it("handles all files having parse errors", () => {
      const fileResults: FileReviewResult[] = [
        createFileResult({ parseError: true, parseErrorMessage: "Error 1" }),
        createFileResult({ parseError: true, parseErrorMessage: "Error 2" }),
      ];

      const result = aggregateReviews(fileResults, []);

      expect(result.result.issues).toHaveLength(0);
      expect(result.result.overallScore).toBeNull();
      expect(result.result.summary).toContain("Reviewed 0 files");
      expect(result.result.summary).toContain("WARNING");
      expect(result.result.summary).toContain("2 files");
    });
  });

  describe("combination of parse errors and partial failures", () => {
    it("reports both parse errors and partial failures separately", () => {
      const fileResults: FileReviewResult[] = [
        createFileResult({ parseError: false }),
        createFileResult({ parseError: true, parseErrorMessage: "Parse failed" }),
      ];
      const partialFailures = [{ file: "failed.ts", error: "Network error" }];

      const result = aggregateReviews(fileResults, partialFailures);

      expect(result.result.summary).toContain("WARNING");
      expect(result.result.summary).toContain("could not be reviewed");
    });

    it("maintains partial failures in result for client access", () => {
      const partialFailures = [
        { file: "fail1.ts", error: "Timeout" },
        { file: "fail2.ts", error: "API Error" },
      ];

      const result = aggregateReviews([], partialFailures);

      expect(result.partialFailures).toEqual(partialFailures);
    });
  });

  describe("summary content with issue severity breakdown", () => {
    it("includes critical and warning counts in summary", () => {
      const fileResults: FileReviewResult[] = [
        createFileResult({
          issues: [
            createIssue({ severity: "critical" }),
            createIssue({ severity: "critical" }),
            createIssue({ severity: "warning" }),
            createIssue({ severity: "suggestion" }),
          ],
          parseError: false,
        }),
      ];

      const result = aggregateReviews(fileResults, []);

      expect(result.result.summary).toContain("2 critical");
      expect(result.result.summary).toContain("1 warning");
    });

    it("excludes severity breakdown from parse-errored files", () => {
      const fileResults: FileReviewResult[] = [
        createFileResult({
          issues: [createIssue({ severity: "critical" })],
          parseError: false,
        }),
        createFileResult({
          filePath: "bad.ts",
          issues: [createIssue({ severity: "critical" })],
          parseError: true,
          parseErrorMessage: "Error",
        }),
      ];

      const result = aggregateReviews(fileResults, []);

      expect(result.result.summary).toContain("1 critical");
    });
  });

  describe("edge cases", () => {
    it("handles empty file results", () => {
      const result = aggregateReviews([], []);

      expect(result.result.issues).toHaveLength(0);
      expect(result.result.overallScore).toBeNull();
      expect(result.result.summary).toContain("Reviewed 0 files");
    });

    it("handles single file with parse error", () => {
      const fileResults: FileReviewResult[] = [
        createFileResult({
          filePath: "only-file.ts",
          parseError: true,
          parseErrorMessage: "Unexpected token",
        }),
      ];

      const result = aggregateReviews(fileResults, []);

      expect(result.result.summary).toContain("WARNING");
      expect(result.result.summary).toContain("1 file");
      expect(result.result.overallScore).toBeNull();
    });

    it("preserves file results including those with parse errors", () => {
      const fileResults: FileReviewResult[] = [
        createFileResult({ filePath: "good.ts", parseError: false }),
        createFileResult({ filePath: "bad.ts", parseError: true, parseErrorMessage: "Error" }),
      ];

      const result = aggregateReviews(fileResults, []);

      expect(result.fileResults).toHaveLength(2);
      expect(result.fileResults.find(f => f.filePath === "bad.ts")?.parseError).toBe(true);
    });
  });
});
