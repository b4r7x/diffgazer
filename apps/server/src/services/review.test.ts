import { describe, it, expect } from "vitest";
import { createGitDiffError } from "./review.js";

function createNodeError(code: string, message: string): NodeJS.ErrnoException {
  const error = new Error(message) as NodeJS.ErrnoException;
  error.code = code;
  return error;
}

describe("createGitDiffError", () => {
  describe("ENOENT - git not installed", () => {
    it("returns actionable message when git is not found", () => {
      const error = createNodeError("ENOENT", "spawn git ENOENT");

      const result = createGitDiffError(error);

      expect(result.message).toContain("Git is not installed or not in PATH");
      expect(result.message).toContain("Please install git");
      expect(result.message).toContain("spawn git ENOENT");
    });
  });

  describe("EACCES - permission denied", () => {
    it("returns actionable message for permission errors", () => {
      const error = createNodeError("EACCES", "permission denied");

      const result = createGitDiffError(error);

      expect(result.message).toContain("Permission denied");
      expect(result.message).toContain("Check file permissions");
      expect(result.message).toContain("permission denied");
    });
  });

  describe("ETIMEDOUT - timeout errors", () => {
    it("handles ETIMEDOUT error code", () => {
      const error = createNodeError("ETIMEDOUT", "operation timed out");

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
        createNodeError("ENOENT", "test"),
        createNodeError("EACCES", "test"),
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
      const error = createNodeError("ENOENT", "spawn git ENOENT");

      const result = createGitDiffError(error);

      expect(result.message).toMatch(/\(Original: .+\)$/);
    });
  });
});
