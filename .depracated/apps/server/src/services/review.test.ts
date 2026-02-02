import { describe, it, expect } from "vitest";
import { createGitDiffError, normalizeIssue, normalizeReviewResponse } from "./review.js";
import { createErrnoException } from "@repo/core/testing";

describe("createGitDiffError", () => {
  describe("ENOENT - git not installed", () => {
    it("returns actionable message when git is not found", () => {
      const error = createErrnoException("spawn git ENOENT", "ENOENT");

      const result = createGitDiffError(error);

      expect(result.message).toContain("Git is not installed or not in PATH");
      expect(result.message).toContain("Please install git");
      expect(result.message).toContain("spawn git ENOENT");
    });
  });

  describe("EACCES - permission denied", () => {
    it("returns actionable message for permission errors", () => {
      const error = createErrnoException("permission denied", "EACCES");

      const result = createGitDiffError(error);

      expect(result.message).toContain("Permission denied");
      expect(result.message).toContain("Check file permissions");
      expect(result.message).toContain("permission denied");
    });
  });

  describe("ETIMEDOUT - timeout errors", () => {
    it("handles ETIMEDOUT error code", () => {
      const error = createErrnoException("operation timed out", "ETIMEDOUT");

      const result = createGitDiffError(error);

      expect(result.message).toContain("timed out");
      expect(result.message).toContain("repository may be too large");
      expect(result.message).toContain("operation timed out");
    });

    it("handles timeout message without error code", () => {
      const error = new Error("Command timed out after 10000ms");

      const result = createGitDiffError(error);

      expect(result.message).toContain("timed out");
      expect(result.message).toContain("Command timed out after 10000ms");
    });
  });

  describe("maxBuffer exceeded", () => {
    it("handles maxBuffer error", () => {
      const error = new Error("stdout maxBuffer length exceeded");

      const result = createGitDiffError(error);

      expect(result.message).toContain("exceeded buffer limit");
      expect(result.message).toContain("too large to process");
      expect(result.message).toContain("stdout maxBuffer");
    });

    it("handles generic maxBuffer error", () => {
      const error = new Error("maxBuffer exceeded");

      const result = createGitDiffError(error);

      expect(result.message).toContain("exceeded buffer limit");
    });
  });

  describe("not a git repository", () => {
    it("handles 'not a git repository' message", () => {
      const error = new Error("fatal: not a git repository (or any parent)");

      const result = createGitDiffError(error);

      expect(result.message).toContain("Not a git repository");
      expect(result.message).toContain("run this command from within a git repository");
      expect(result.message).toContain("fatal:");
    });

    it("handles generic fatal git errors", () => {
      const error = new Error("fatal: unable to access repository");

      const result = createGitDiffError(error);

      expect(result.message).toContain("Not a git repository");
      expect(result.message).toContain("fatal:");
    });
  });

  describe("generic errors", () => {
    it("preserves unknown error messages in fallback", () => {
      const error = new Error("Some unexpected git error");

      const result = createGitDiffError(error);

      expect(result.message).toContain("Failed to get git diff");
      expect(result.message).toContain("Some unexpected git error");
    });

    it("handles non-Error values", () => {
      const result = createGitDiffError("string error");

      expect(result.message).toContain("Failed to get git diff");
      expect(result.message).toContain("string error");
    });

    it("handles null/undefined", () => {
      const result = createGitDiffError(null);

      expect(result.message).toContain("Failed to get git diff");
      expect(result.message).toContain("null");
    });
  });

  describe("error message format", () => {
    it("always returns an Error instance", () => {
      const testCases = [
        createErrnoException("test", "ENOENT"),
        createErrnoException("test", "EACCES"),
        new Error("fatal: test"),
        new Error("unknown"),
        "string",
        null,
      ];

      for (const input of testCases) {
        const result = createGitDiffError(input);
        expect(result).toBeInstanceOf(Error);
      }
    });

    it("includes '(Original: ...)' suffix for specific errors", () => {
      const error = createErrnoException("spawn git ENOENT", "ENOENT");

      const result = createGitDiffError(error);

      expect(result.message).toMatch(/\(Original: .+\)$/);
    });
  });
});

describe("normalizeIssue", () => {
  it("adds null for missing file, line, and suggestion fields", () => {
    const issue = {
      severity: "warning",
      category: "logic",
      title: "Test issue",
      description: "Test description",
    };

    const result = normalizeIssue(issue);

    expect(result).toEqual({
      severity: "warning",
      category: "logic",
      title: "Test issue",
      description: "Test description",
      file: null,
      line: null,
      suggestion: null,
    });
  });

  it("preserves existing values for optional fields", () => {
    const issue = {
      severity: "critical",
      category: "security",
      title: "SQL Injection",
      description: "Possible SQL injection",
      file: "src/db.ts",
      line: 42,
      suggestion: "Use parameterized queries",
    };

    const result = normalizeIssue(issue);

    expect(result).toEqual(issue);
  });

  it("converts non-number line values to null", () => {
    const issue = {
      severity: "warning",
      category: "logic",
      title: "Test",
      description: "Test",
      line: "42",
    };

    const result = normalizeIssue(issue) as Record<string, unknown>;

    expect(result.line).toBe(null);
  });

  it("returns non-objects unchanged", () => {
    expect(normalizeIssue(null)).toBe(null);
    expect(normalizeIssue("string")).toBe("string");
    expect(normalizeIssue(42)).toBe(42);
  });
});

describe("normalizeReviewResponse", () => {
  it("adds defaults for missing optional fields", () => {
    const response = {
      summary: "Code looks good",
      issues: [],
    };

    const result = normalizeReviewResponse(response);

    expect(result).toEqual({
      summary: "Code looks good",
      issues: [],
      overallScore: null,
    });
  });

  it("normalizes valid overallScore", () => {
    const response = {
      summary: "Good code",
      issues: [],
      overallScore: 8,
    };

    const result = normalizeReviewResponse(response);

    expect(result).toEqual({
      summary: "Good code",
      issues: [],
      overallScore: 8,
    });
  });

  it("sets overallScore to null when out of range", () => {
    const responseHigh = { summary: "Test", issues: [], overallScore: 15 };
    const responseLow = { summary: "Test", issues: [], overallScore: -1 };
    const responseString = { summary: "Test", issues: [], overallScore: "8" };

    expect((normalizeReviewResponse(responseHigh) as Record<string, unknown>).overallScore).toBe(null);
    expect((normalizeReviewResponse(responseLow) as Record<string, unknown>).overallScore).toBe(null);
    expect((normalizeReviewResponse(responseString) as Record<string, unknown>).overallScore).toBe(null);
  });

  it("normalizes issues array items", () => {
    const response = {
      summary: "Test",
      issues: [
        { severity: "warning", category: "logic", title: "Issue 1", description: "Desc 1" },
        { severity: "critical", category: "security", title: "Issue 2", description: "Desc 2", file: "test.ts", line: 10, suggestion: "Fix it" },
      ],
      overallScore: 7,
    };

    const result = normalizeReviewResponse(response) as Record<string, unknown>;
    const issues = result.issues as Array<Record<string, unknown>>;

    expect(issues[0]).toEqual({
      severity: "warning",
      category: "logic",
      title: "Issue 1",
      description: "Desc 1",
      file: null,
      line: null,
      suggestion: null,
    });
    expect(issues[1]).toEqual({
      severity: "critical",
      category: "security",
      title: "Issue 2",
      description: "Desc 2",
      file: "test.ts",
      line: 10,
      suggestion: "Fix it",
    });
  });

  it("handles missing issues array", () => {
    const response = { summary: "Test" };

    const result = normalizeReviewResponse(response) as Record<string, unknown>;

    expect(result.issues).toEqual([]);
  });

  it("handles missing summary", () => {
    const response = { issues: [], overallScore: 5 };

    const result = normalizeReviewResponse(response) as Record<string, unknown>;

    expect(result.summary).toBe("");
  });

  it("returns non-objects unchanged", () => {
    expect(normalizeReviewResponse(null)).toBe(null);
    expect(normalizeReviewResponse("string")).toBe("string");
  });
});
