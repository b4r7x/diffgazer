import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecFileAsync } = vi.hoisted(() => ({
  mockExecFileAsync: vi.fn(),
}));

vi.mock("node:child_process", () => {
  const execFileFn = Object.assign(
    (...args: unknown[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === "function") (cb as (err: null, stdout: string, stderr: string) => void)(null, "", "");
      return {};
    },
    { [Symbol.for("nodejs.util.promisify.custom")]: mockExecFileAsync },
  );
  return { execFile: execFileFn };
});

import { createGitService } from "./service.js";

function setupExecResult(stdout: string) {
  mockExecFileAsync.mockResolvedValue({ stdout, stderr: "" });
}

function setupExecError(error: Error) {
  mockExecFileAsync.mockRejectedValue(error);
}

describe("createGitService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getStatus", () => {
    it("should parse a clean repo with branch and remote", async () => {
      setupExecResult("## main...origin/main\n");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.isGitRepo).toBe(true);
      expect(status.branch).toBe("main");
      expect(status.remoteBranch).toBe("origin/main");
      expect(status.ahead).toBe(0);
      expect(status.behind).toBe(0);
      expect(status.hasChanges).toBe(false);
      expect(status.files.staged).toEqual([]);
      expect(status.files.unstaged).toEqual([]);
      expect(status.files.untracked).toEqual([]);
    });

    it("should parse branch with ahead/behind counts", async () => {
      setupExecResult("## feature...origin/feature [ahead 3, behind 2]\n");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.branch).toBe("feature");
      expect(status.remoteBranch).toBe("origin/feature");
      expect(status.ahead).toBe(3);
      expect(status.behind).toBe(2);
    });

    it("should parse branch with only ahead count", async () => {
      setupExecResult("## main...origin/main [ahead 5]\n");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.ahead).toBe(5);
      expect(status.behind).toBe(0);
    });

    it("should parse branch without remote tracking", async () => {
      setupExecResult("## feature-branch\n");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.branch).toBe("feature-branch");
      expect(status.remoteBranch).toBeNull();
    });

    it("should parse staged modified files", async () => {
      setupExecResult("## main\nM  src/file.ts\n");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.hasChanges).toBe(true);
      expect(status.files.staged).toHaveLength(1);
      expect(status.files.staged[0]?.path).toBe("src/file.ts");
      expect(status.files.staged[0]?.indexStatus).toBe("M");
    });

    it("should parse unstaged modified files", async () => {
      setupExecResult("## main\n M src/file.ts\n");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.hasChanges).toBe(true);
      expect(status.files.unstaged).toHaveLength(1);
      expect(status.files.unstaged[0]?.path).toBe("src/file.ts");
      expect(status.files.unstaged[0]?.workTreeStatus).toBe("M");
    });

    it("should parse untracked files", async () => {
      setupExecResult("## main\n?? new-file.ts\n");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.hasChanges).toBe(true);
      expect(status.files.untracked).toHaveLength(1);
      expect(status.files.untracked[0]?.path).toBe("new-file.ts");
    });

    it("should parse added files", async () => {
      setupExecResult("## main\nA  new-file.ts\n");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.files.staged).toHaveLength(1);
      expect(status.files.staged[0]?.indexStatus).toBe("A");
    });

    it("should parse deleted files", async () => {
      setupExecResult("## main\nD  old-file.ts\n");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.files.staged).toHaveLength(1);
      expect(status.files.staged[0]?.indexStatus).toBe("D");
    });

    it("should detect conflicted files", async () => {
      setupExecResult("## main\nUU conflicted.ts\n");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.conflicted).toContain("conflicted.ts");
    });

    it("should handle multiple files with mixed statuses", async () => {
      const output = [
        "## main...origin/main",
        "M  staged.ts",
        " M unstaged.ts",
        "?? untracked.ts",
        "A  added.ts",
        "",
      ].join("\n");
      setupExecResult(output);
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.files.staged).toHaveLength(2); // M and A
      expect(status.files.unstaged).toHaveLength(1);
      expect(status.files.untracked).toHaveLength(1);
      expect(status.hasChanges).toBe(true);
    });

    it("should handle empty output (clean repo)", async () => {
      setupExecResult("");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.isGitRepo).toBe(true);
      expect(status.hasChanges).toBe(false);
      expect(status.branch).toBeNull();
    });

    it("should return empty status when git command fails", async () => {
      setupExecError(new Error("fatal: not a git repository"));
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.isGitRepo).toBe(false);
      expect(status.branch).toBeNull();
      expect(status.hasChanges).toBe(false);
    });

    it("should skip lines shorter than 3 characters", async () => {
      setupExecResult("## main\nXY\n");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.files.staged).toEqual([]);
      expect(status.files.unstaged).toEqual([]);
    });
  });

  describe("isGitInstalled", () => {
    it("should return true when git is available", async () => {
      setupExecResult("git version 2.40.0");
      const git = createGitService();

      expect(await git.isGitInstalled()).toBe(true);
    });

    it("should return false when git is not found", async () => {
      setupExecError(new Error("ENOENT"));
      const git = createGitService();

      expect(await git.isGitInstalled()).toBe(false);
    });
  });

  describe("getDiff", () => {
    it("should call git diff --cached for staged mode", async () => {
      setupExecResult("diff --git a/file.ts b/file.ts\n");
      const git = createGitService({ cwd: "/test" });

      await git.getDiff("staged");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "git",
        ["diff", "--cached"],
        expect.objectContaining({ cwd: "/test" }),
      );
    });

    it("should call git diff for unstaged mode", async () => {
      setupExecResult("diff --git a/file.ts b/file.ts\n");
      const git = createGitService({ cwd: "/test" });

      await git.getDiff("unstaged");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "git",
        ["diff"],
        expect.objectContaining({ cwd: "/test" }),
      );
    });

    it("should call git diff for files mode (falls through to unstaged)", async () => {
      setupExecResult("");
      const git = createGitService({ cwd: "/test" });

      await git.getDiff("files");

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "git",
        ["diff"],
        expect.objectContaining({ cwd: "/test" }),
      );
    });

    it("should return empty string when no diff", async () => {
      setupExecResult("");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getDiff();

      expect(result).toBe("");
    });
  });

  describe("getBlame", () => {
    it("should parse porcelain blame output", async () => {
      const porcelainOutput = [
        "abc1234 1 1 1",
        "author John Doe",
        "author-mail <john@example.com>",
        "author-time 1700000000",
        "author-tz +0000",
        "committer John Doe",
        "committer-mail <john@example.com>",
        "committer-time 1700000000",
        "committer-tz +0000",
        "summary Fix the bug",
        "filename src/file.ts",
        "\tconst x = 1;",
      ].join("\n");
      setupExecResult(porcelainOutput);
      const git = createGitService({ cwd: "/test" });

      const blame = await git.getBlame("src/file.ts", 1);

      expect(blame).not.toBeNull();
      expect(blame!.author).toBe("John Doe");
      expect(blame!.authorEmail).toBe("john@example.com");
      expect(blame!.commit).toBe("abc1234");
      expect(blame!.summary).toBe("Fix the bug");
      expect(blame!.commitDate).toBe(new Date(1700000000 * 1000).toISOString());
    });

    it("should return null when blame command fails", async () => {
      setupExecError(new Error("fatal: no such path"));
      const git = createGitService({ cwd: "/test" });

      const blame = await git.getBlame("nonexistent.ts", 1);

      expect(blame).toBeNull();
    });
  });

  describe("getFileLines", () => {
    it("should return correct line slice for startLine/endLine", async () => {
      const fileContent = "line1\nline2\nline3\nline4\nline5";
      setupExecResult(fileContent);
      const git = createGitService({ cwd: "/test" });

      const lines = await git.getFileLines("src/file.ts", 2, 4);

      expect(lines).toEqual(["line2", "line3", "line4"]);
    });

    it("should handle out-of-range lines gracefully", async () => {
      const fileContent = "line1\nline2";
      setupExecResult(fileContent);
      const git = createGitService({ cwd: "/test" });

      const lines = await git.getFileLines("src/file.ts", 5, 10);

      expect(lines).toEqual([]);
    });

    it("should return empty array when command fails", async () => {
      setupExecError(new Error("fatal: path not found"));
      const git = createGitService({ cwd: "/test" });

      const lines = await git.getFileLines("nonexistent.ts", 1, 5);

      expect(lines).toEqual([]);
    });
  });

  describe("getHeadCommit", () => {
    it("should return ok with commit hash on success", async () => {
      setupExecResult("abc123def456\n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getHeadCommit();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("abc123def456");
      }
    });

    it("should return err when stdout is empty", async () => {
      setupExecResult("  \n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getHeadCommit();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("Empty commit hash");
      }
    });

    it("should return err when command fails", async () => {
      setupExecError(new Error("fatal: not a git repo"));
      const git = createGitService({ cwd: "/test" });

      const result = await git.getHeadCommit();

      expect(result.ok).toBe(false);
    });
  });

  describe("getStatusHash", () => {
    it("should return a hex hash when there are changes", async () => {
      setupExecResult(" M file1.ts\n M file2.ts\n");
      const git = createGitService({ cwd: "/test" });

      const hash = await git.getStatusHash();

      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it("should return empty string when no changes", async () => {
      setupExecResult("");
      const git = createGitService({ cwd: "/test" });

      const hash = await git.getStatusHash();

      expect(hash).toBe("");
    });

    it("should return empty string when command fails", async () => {
      setupExecError(new Error("git error"));
      const git = createGitService({ cwd: "/test" });

      const hash = await git.getStatusHash();

      expect(hash).toBe("");
    });
  });
});
