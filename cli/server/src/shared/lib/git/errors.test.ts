import { describe, expect, it } from "vitest";
import { createGitDiffError } from "./errors.js";

describe("createGitDiffError", () => {
  it.each([
    {
      kind: "missing repository",
      input: new Error("fatal: not a git repository"),
      expectedFragment: "Not a git repository",
      includesOriginal: true,
    },
    {
      kind: "spawn ENOENT",
      input: new Error("spawn git ENOENT"),
      expectedFragment: "Git is not installed",
      includesOriginal: true,
    },
    {
      kind: "command not found",
      input: new Error("git command not found"),
      expectedFragment: "Git is not installed",
      includesOriginal: true,
    },
    {
      kind: "permission denied",
      input: new Error("EACCES permission denied"),
      expectedFragment: "Permission denied",
      includesOriginal: true,
    },
    {
      kind: "operation timeout",
      input: new Error("operation timed out"),
      expectedFragment: "timed out",
      includesOriginal: true,
    },
    {
      kind: "buffer exceeded",
      input: new Error("stdout maxBuffer length exceeded"),
      expectedFragment: "buffer limit",
      includesOriginal: true,
    },
  ])("produces a $kind message that wraps the original error", ({
    input,
    expectedFragment,
    includesOriginal,
  }) => {
    const result = createGitDiffError(input);

    expect(result.message).toContain(expectedFragment);
    if (includesOriginal) expect(result.message).toContain("Original:");
  });

  it("returns a generic 'Failed to get git diff' message for unrecognized errors", () => {
    const result = createGitDiffError(new Error("something completely unexpected"));

    expect(result.message).toContain("Failed to get git diff");
    expect(result.message).toContain("something completely unexpected");
    expect(result.message).not.toContain("Original:");
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
