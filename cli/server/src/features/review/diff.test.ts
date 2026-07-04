import { err, ok } from "@diffgazer/core/result";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { describe, expect, it } from "vitest";
import type { createGitService } from "../../shared/lib/git/service.js";
import { resolveGitDiff } from "./diff.js";

type GitService = ReturnType<typeof createGitService>;

const SINGLE_FILE_DIFF = [
  "diff --git a/src/index.ts b/src/index.ts",
  "index 1111111..2222222 100644",
  "--- a/src/index.ts",
  "+++ b/src/index.ts",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "",
].join("\n");

function makeGitService(getDiff: GitService["getDiff"]): GitService {
  return { getDiff } as GitService;
}

describe("resolveGitDiff", () => {
  it("maps a git timeout diff failure to a non-GIT_NOT_FOUND error code", async () => {
    const result = await resolveGitDiff({
      gitService: makeGitService(async () => err({ message: "git diff operation timed out" })),
      mode: "unstaged",
      emit: async () => undefined,
      reviewId: "review-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ReviewErrorCode.GENERATION_FAILED);
      expect(result.error.code).not.toBe(ReviewErrorCode.GIT_NOT_FOUND);
      expect(result.error.message).toContain("timed out");
    }
  });

  it("keeps missing git diff failures mapped to GIT_NOT_FOUND", async () => {
    const result = await resolveGitDiff({
      gitService: makeGitService(async () => err({ message: "spawn git ENOENT" })),
      mode: "unstaged",
      emit: async () => undefined,
      reviewId: "review-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe(ReviewErrorCode.GIT_NOT_FOUND);
    }
  });

  it("uses readable no-diff copy for files mode", async () => {
    const result = await resolveGitDiff({
      gitService: makeGitService(async () => ok(SINGLE_FILE_DIFF)),
      mode: "files",
      files: ["src/missing.ts"],
      emit: async () => undefined,
      reviewId: "review-1",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("None of the specified files have changes");
    }
  });
});
