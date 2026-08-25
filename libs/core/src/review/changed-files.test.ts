import { describe, expect, it } from "vitest";
import type { GitFileEntry, GitStatus } from "../schemas/git.js";
import { describeFileStatus, reviewableFilesForMode } from "./changed-files.js";

function entry(path: string, overrides: Partial<GitFileEntry> = {}): GitFileEntry {
  return { path, indexStatus: "M", workTreeStatus: "M", ...overrides };
}

function makeStatus(
  overrides: Partial<GitStatus["files"]> = {},
  conflicted: string[] = [],
): GitStatus {
  return {
    isGitRepo: true,
    branch: "main",
    remoteBranch: null,
    ahead: 0,
    behind: 0,
    files: { staged: [], unstaged: [], untracked: [], ...overrides },
    hasChanges: true,
    conflicted,
  };
}

describe("reviewableFilesForMode", () => {
  it("reads the index bucket for staged, mirroring git diff --cached", () => {
    const status = makeStatus({
      staged: [entry("src/b.ts", { indexStatus: "A" })],
      unstaged: [entry("src/z.ts")],
    });

    expect(reviewableFilesForMode(status, "staged")).toEqual([
      { path: "src/b.ts", status: "A", conflicted: false },
    ]);
  });

  it("reads the worktree bucket for unstaged, mirroring a plain git diff", () => {
    const status = makeStatus({
      staged: [entry("src/z.ts")],
      unstaged: [entry("src/b.ts", { workTreeStatus: "D" })],
    });

    expect(reviewableFilesForMode(status, "unstaged")).toEqual([
      { path: "src/b.ts", status: "D", conflicted: false },
    ]);
  });

  it("omits untracked files, which no git diff reports", () => {
    const status = makeStatus({ untracked: [entry("new.ts", { workTreeStatus: "?" })] });

    expect(reviewableFilesForMode(status, "unstaged")).toEqual([]);
  });

  it("marks files with unresolved merge conflicts, which the review excludes", () => {
    const status = makeStatus({ unstaged: [entry("src/a.ts")] }, ["src/a.ts"]);

    expect(reviewableFilesForMode(status, "unstaged")[0]?.conflicted).toBe(true);
  });

  it("carries the previous name of a rename", () => {
    const status = makeStatus({
      staged: [entry("src/new.ts", { indexStatus: "R", previousPath: "src/old.ts" })],
    });

    expect(reviewableFilesForMode(status, "staged")[0]?.previousPath).toBe("src/old.ts");
  });

  it("orders rows by path so the list does not reshuffle between reads", () => {
    const status = makeStatus({
      unstaged: [entry("src/c.ts"), entry("src/a.ts"), entry("src/b.ts")],
    });

    expect(reviewableFilesForMode(status, "unstaged").map((file) => file.path)).toEqual([
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
    ]);
  });
});

describe("describeFileStatus", () => {
  it("names the codes a picker shows", () => {
    expect(describeFileStatus("A")).toBe("added");
    expect(describeFileStatus("D")).toBe("deleted");
    expect(describeFileStatus("R")).toBe("renamed");
  });

  it("falls back to a neutral word for codes with no name of their own", () => {
    expect(describeFileStatus(" ")).toBe("changed");
  });
});
