import { describe, expect, it } from "vitest";
import { createGitDiffError } from "./errors.js";

describe("createGitDiffError", () => {
  it.each([
    {
      kind: "missing repository",
      input: new Error("fatal: not a git repository"),
      expectedFragment: "Not a git repository",
      expectedCode: "NOT_A_REPOSITORY",
    },
    {
      kind: "spawn ENOENT",
      input: new Error("spawn git ENOENT"),
      expectedFragment: "Git is not installed",
      expectedCode: "GIT_NOT_FOUND",
    },
    {
      kind: "command not found",
      input: new Error("git command not found"),
      expectedFragment: "Git is not installed",
      expectedCode: "GIT_NOT_FOUND",
    },
    {
      kind: "permission denied",
      input: new Error("EACCES permission denied"),
      expectedFragment: "Permission denied",
      expectedCode: "PERMISSION_DENIED",
    },
    {
      kind: "operation timeout",
      input: new Error("operation timed out"),
      expectedFragment: "timed out",
      expectedCode: "TIMEOUT",
    },
    {
      kind: "buffer exceeded",
      input: new Error("stdout maxBuffer length exceeded"),
      expectedFragment: "buffer limit",
      expectedCode: "BUFFER_EXCEEDED",
    },
  ])("produces a $kind code and message that wraps the original error", ({
    input,
    expectedFragment,
    expectedCode,
  }) => {
    const result = createGitDiffError(input);

    expect(result.code).toBe(expectedCode);
    expect(result.message).toContain(expectedFragment);
    expect(result.message).toContain("Original:");
  });

  it("returns a generic 'Failed to get git diff' message for unrecognized errors", () => {
    const result = createGitDiffError(new Error("something completely unexpected"));

    expect(result.code).toBe("UNKNOWN");
    expect(result.message).toContain("Failed to get git diff");
    expect(result.message).toContain("something completely unexpected");
    expect(result.message).not.toContain("Original:");
  });

  it.each([
    "fatal: index file corrupt",
    "fatal: bad object HEAD",
    "fatal: object not found",
    "fatal: bad config line 1 in file .git/config",
  ])("preserves unrelated Git fatal errors without claiming the repository is missing", (message) => {
    const result = createGitDiffError(new Error(message));

    expect(result.message).toBe(`Failed to get git diff: ${message}`);
  });

  it("formats non-Error values into the generic fallback message", () => {
    const result = createGitDiffError("raw string error");

    expect(result.message).toContain("Failed to get git diff");
    expect(result.message).toContain("raw string error");
  });

  it("returns a generic message when the underlying error has no text", () => {
    const result = createGitDiffError(new Error(""));

    expect(result.message).toContain("Failed to get git diff");
  });
});
