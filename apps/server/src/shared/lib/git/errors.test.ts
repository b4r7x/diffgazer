import { describe, it, expect } from "vitest";
import { createGitDiffError } from "./errors.js";

describe("createGitDiffError", () => {
  it("should classify 'not a git repository' as NOT_A_REPOSITORY", () => {
    const error = new Error("fatal: not a git repository");
    const result = createGitDiffError(error);

    expect(result.message).toContain("Not a git repository");
    expect(result.message).toContain("Original:");
  });

  it("should classify 'fatal:' prefix as NOT_A_REPOSITORY", () => {
    const error = new Error("fatal: some git error");
    const result = createGitDiffError(error);

    expect(result.message).toContain("Not a git repository");
  });

  it("should classify enoent/spawn git as GIT_NOT_FOUND", () => {
    const error = new Error("spawn git ENOENT");
    const result = createGitDiffError(error);

    expect(result.message).toContain("Git is not installed");
    expect(result.message).toContain("Original:");
  });

  it("should classify 'not found' as GIT_NOT_FOUND", () => {
    const error = new Error("git command not found");
    const result = createGitDiffError(error);

    expect(result.message).toContain("Git is not installed");
  });

  it("should classify permission errors as PERMISSION_DENIED", () => {
    const error = new Error("EACCES permission denied");
    const result = createGitDiffError(error);

    expect(result.message).toContain("Permission denied");
    expect(result.message).toContain("Original:");
  });

  it("should classify timeout errors as TIMEOUT", () => {
    const error = new Error("operation timed out");
    const result = createGitDiffError(error);

    expect(result.message).toContain("timed out");
    expect(result.message).toContain("Original:");
  });

  it("should classify maxBuffer errors as BUFFER_EXCEEDED", () => {
    const error = new Error("stdout maxBuffer length exceeded");
    const result = createGitDiffError(error);

    expect(result.message).toContain("buffer limit");
    expect(result.message).toContain("Original:");
  });

  it("should return UNKNOWN for unrecognized errors", () => {
    const error = new Error("something completely unexpected");
    const result = createGitDiffError(error);

    expect(result.message).toContain("Failed to get git diff");
    expect(result.message).toContain("something completely unexpected");
    expect(result.message).not.toContain("Original:");
  });

  it("should handle non-Error values", () => {
    const result = createGitDiffError("raw string error");

    expect(result.message).toContain("Failed to get git diff");
    expect(result.message).toContain("raw string error");
  });

  it("should handle empty error message", () => {
    const error = new Error("");
    const result = createGitDiffError(error);

    expect(result.message).toContain("Failed to get git diff");
  });
});
