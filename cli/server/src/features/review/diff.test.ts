import { err, ok } from "@diffgazer/core/result";
import { ReviewErrorCode } from "@diffgazer/core/schemas/review";
import { describe, expect, it } from "vitest";
import type { createGitService } from "../../shared/lib/git/service.js";
import { filterDiffByFiles, MAX_DIFF_SIZE_BYTES, resolveGitDiff } from "./diff.js";
import { makeFileDiff, makeParsedDiff } from "./testing/factories.js";

type GitService = ReturnType<typeof createGitService>;

const TWO_FILE_DIFF = [
  "diff --git a/src/index.ts b/src/index.ts",
  "index 1111111..2222222 100644",
  "--- a/src/index.ts",
  "+++ b/src/index.ts",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "diff --git a/README.md b/README.md",
  "index 3333333..4444444 100644",
  "--- a/README.md",
  "+++ b/README.md",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "",
].join("\n");

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

function makeGitService(
  getDiff: GitService["getDiff"],
  getStatus?: GitService["getStatus"],
): GitService {
  return {
    getDiff,
    getStatus:
      getStatus ??
      (async () =>
        ok({
          isGitRepo: true,
          branch: "main",
          remoteBranch: null,
          ahead: 0,
          behind: 0,
          files: { staged: [], unstaged: [], untracked: [] },
          hasChanges: true,
          conflicted: [],
        })),
  } as GitService;
}

function makeDiffTestFile(filePath: string, additions = 1, deletions = 0) {
  return makeFileDiff({
    filePath,
    rawDiff: "",
    stats: { additions, deletions, sizeBytes: 100 },
  });
}

describe("resolveGitDiff", () => {
  it("rejects files mode without pathspecs before invoking git", async () => {
    let getDiffCalls = 0;
    const result = await resolveGitDiff({
      gitService: makeGitService(async () => {
        getDiffCalls += 1;
        return ok(SINGLE_FILE_DIFF);
      }),
      mode: "files",
      emit: async () => undefined,
      reviewId: "review-1",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: ReviewErrorCode.GENERATION_FAILED,
        kind: "review_abort",
        message: "files[] must be non-empty when mode is 'files'",
        step: "diff",
      },
    });
    expect(getDiffCalls).toBe(0);
  });

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
      gitService: makeGitService(async () => ok("")),
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

  it("returns NO_DIFF without success events when only internal files changed", async () => {
    const events: Array<{ type: string }> = [];
    const internalDiff = SINGLE_FILE_DIFF.replaceAll("src/index.ts", ".diffgazer/config.json");

    const result = await resolveGitDiff({
      gitService: makeGitService(async () => ok(internalDiff)),
      mode: "unstaged",
      emit: async (event) => {
        events.push({ type: event.type });
      },
      reviewId: "internal-only",
    });

    expect(result).toMatchObject({
      ok: false,
      error: { code: ReviewErrorCode.NO_DIFF, step: "diff" },
    });
    expect(events).toEqual([{ type: "step_start" }]);
  });

  it("emits review_started after file filtering", async () => {
    const events: unknown[] = [];

    const result = await resolveGitDiff({
      gitService: makeGitService(async () => ok(TWO_FILE_DIFF)),
      mode: "unstaged",
      files: ["src/index.ts"],
      emit: async (event) => {
        events.push(event);
      },
      reviewId: "review-1",
    });

    expect(result.ok).toBe(true);
    expect(events).toMatchObject([
      { type: "step_start", step: "diff" },
      { type: "step_complete", step: "diff" },
      { type: "review_started", filesTotal: 1 },
    ]);
  });

  it("does not emit review_started when file filtering removes every diff file", async () => {
    const events: unknown[] = [];

    const result = await resolveGitDiff({
      gitService: makeGitService(async () => ok(TWO_FILE_DIFF)),
      mode: "unstaged",
      files: ["missing.ts"],
      emit: async (event) => {
        events.push(event);
      },
      reviewId: "review-1",
    });

    expect(result.ok).toBe(false);
    expect(events).toMatchObject([{ type: "step_start", step: "diff" }]);
  });

  const COMBINED_CONFLICT_DIFF = [
    "diff --cc conflicted.ts",
    "index 1111111,2222222..3333333 100644",
    "--- a/conflicted.ts",
    "+++ b/conflicted.ts",
    "@@@ -1,3 -1,3 -1,6 @@@",
    " line1",
    "-ours",
    "+theirs",
    " line3",
    "",
  ].join("\n");

  const MIXED_CONFLICT_AND_REGULAR_DIFF = [
    COMBINED_CONFLICT_DIFF,
    "diff --git a/src/index.ts b/src/index.ts",
    "index 1111111..2222222 100644",
    "--- a/src/index.ts",
    "+++ b/src/index.ts",
    "@@ -1 +1 @@",
    "-old",
    "+new",
    "",
  ].join("\n");

  it("fails closed when combined diff blocks leave no reviewable files", async () => {
    const result = await resolveGitDiff({
      gitService: makeGitService(
        async () => ok(COMBINED_CONFLICT_DIFF),
        async () =>
          ok({
            isGitRepo: true,
            branch: "main",
            remoteBranch: null,
            ahead: 0,
            behind: 0,
            files: { staged: [], unstaged: [], untracked: [] },
            hasChanges: true,
            conflicted: ["conflicted.ts"],
          }),
      ),
      mode: "unstaged",
      emit: async () => undefined,
      reviewId: "review-conflicts-only",
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: ReviewErrorCode.GENERATION_FAILED,
        step: "diff",
        message: expect.stringContaining("conflicted.ts"),
      },
    });
  });

  it("surfaces a user-visible notice when conflicted files are excluded from a mixed diff", async () => {
    const events: unknown[] = [];

    const result = await resolveGitDiff({
      gitService: makeGitService(
        async () => ok(MIXED_CONFLICT_AND_REGULAR_DIFF),
        async () =>
          ok({
            isGitRepo: true,
            branch: "main",
            remoteBranch: null,
            ahead: 0,
            behind: 0,
            files: { staged: [], unstaged: [], untracked: [] },
            hasChanges: true,
            conflicted: ["conflicted.ts"],
          }),
      ),
      mode: "unstaged",
      emit: async (event) => {
        events.push(event);
      },
      reviewId: "review-mixed-conflicts",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.files.map((file) => file.filePath)).toEqual(["src/index.ts"]);
    }
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "chunk",
          content: expect.stringContaining("conflicted.ts"),
        }),
        expect.objectContaining({ type: "review_started", filesTotal: 1 }),
      ]),
    );
  });

  it("refuses a diff past the pathological byte ceiling and names what usually causes it", async () => {
    const header = [
      "diff --git a/pnpm-lock.yaml b/pnpm-lock.yaml",
      "index 1111111..2222222 100644",
      "--- a/pnpm-lock.yaml",
      "+++ b/pnpm-lock.yaml",
      "@@ -0,0 +1,2 @@",
      "",
    ].join("\n");
    const oversized = `${header}+${"lockfile-entry ".repeat((MAX_DIFF_SIZE_BYTES / 15) | 0)}\n`;

    const result = await resolveGitDiff({
      gitService: makeGitService(async () => ok(oversized)),
      mode: "unstaged",
      emit: async () => undefined,
      reviewId: "review-oversized",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe(ReviewErrorCode.DIFF_TOO_LARGE);
    expect(result.error.step).toBe("diff");
    expect(result.error.message).toContain("10MB ceiling");
    expect(result.error.message).toContain("lockfile");
  }, 30_000);
});

describe("filterDiffByFiles", () => {
  const parsed = makeParsedDiff([
    makeDiffTestFile("src/index.ts"),
    makeDiffTestFile("src/utils.ts"),
    makeDiffTestFile("README.md"),
  ]);

  it("returns all files when no filter is provided", () => {
    const result = filterDiffByFiles(parsed, []);
    expect(result.files).toHaveLength(3);
  });

  it("matches canonical paths and recalculates totals for included files", () => {
    const result = filterDiffByFiles(parsed, ["src/index.ts", "src/utils.ts"]);
    expect(result.files).toHaveLength(2);
    expect(result.files.map((f) => f.filePath)).toEqual(["src/index.ts", "src/utils.ts"]);
    expect(result.totalStats).toEqual({
      filesChanged: 2,
      additions: 2,
      deletions: 0,
      totalSizeBytes: 200,
    });
  });

  it("returns empty totals when no files match", () => {
    const result = filterDiffByFiles(parsed, ["nonexistent.ts"]);
    expect(result.files).toHaveLength(0);
    expect(result.totalStats.filesChanged).toBe(0);
  });
});
