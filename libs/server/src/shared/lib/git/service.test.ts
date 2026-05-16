import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockExecFileAsync } = vi.hoisted(() => ({
  mockExecFileAsync: vi.fn(),
}));

// Boundary mock: node:child_process is the Node.js external-process boundary; createGitService spawns the `git` CLI, so tests stub execFile to provide canned stdout/stderr.
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
    it("reports a clean repo with branch and remote tracking", async () => {
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

    it.each([
      {
        scenario: "ahead and behind counts",
        output: "## feature...origin/feature [ahead 3, behind 2]\n",
        branch: "feature",
        remoteBranch: "origin/feature",
        ahead: 3,
        behind: 2,
      },
      {
        scenario: "only ahead count",
        output: "## main...origin/main [ahead 5]\n",
        branch: "main",
        remoteBranch: "origin/main",
        ahead: 5,
        behind: 0,
      },
      {
        scenario: "no remote tracking",
        output: "## feature-branch\n",
        branch: "feature-branch",
        remoteBranch: null,
        ahead: 0,
        behind: 0,
      },
    ])("parses branch header with $scenario", async ({ output, branch, remoteBranch, ahead, behind }) => {
      setupExecResult(output);
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.branch).toBe(branch);
      expect(status.remoteBranch).toBe(remoteBranch);
      expect(status.ahead).toBe(ahead);
      expect(status.behind).toBe(behind);
    });

    it.each([
      { kind: "staged modified", output: "## main\nM  src/file.ts\n", path: "src/file.ts", indexStatus: "M", group: "staged" as const },
      { kind: "staged added", output: "## main\nA  new-file.ts\n", path: "new-file.ts", indexStatus: "A", group: "staged" as const },
      { kind: "staged deleted", output: "## main\nD  old-file.ts\n", path: "old-file.ts", indexStatus: "D", group: "staged" as const },
    ])("places $kind file in the staged bucket", async ({ output, path, indexStatus }) => {
      setupExecResult(output);
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.hasChanges).toBe(true);
      expect(status.files.staged).toHaveLength(1);
      expect(status.files.staged[0]?.path).toBe(path);
      expect(status.files.staged[0]?.indexStatus).toBe(indexStatus);
    });

    it("places worktree-only changes in the unstaged bucket", async () => {
      setupExecResult("## main\n M src/file.ts\n");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.hasChanges).toBe(true);
      expect(status.files.unstaged).toHaveLength(1);
      expect(status.files.unstaged[0]?.path).toBe("src/file.ts");
      expect(status.files.unstaged[0]?.workTreeStatus).toBe("M");
    });

    it("places ?? files in the untracked bucket", async () => {
      setupExecResult("## main\n?? new-file.ts\n");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.hasChanges).toBe(true);
      expect(status.files.untracked).toHaveLength(1);
      expect(status.files.untracked[0]?.path).toBe("new-file.ts");
    });

    it("reports UU entries as conflicted files", async () => {
      setupExecResult("## main\nUU conflicted.ts\n");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.conflicted).toContain("conflicted.ts");
    });

    it("splits mixed-status entries into the correct buckets", async () => {
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

      expect(status.files.staged).toHaveLength(2);
      expect(status.files.unstaged).toHaveLength(1);
      expect(status.files.untracked).toHaveLength(1);
      expect(status.hasChanges).toBe(true);
    });

    it("reports no changes for an empty porcelain output", async () => {
      setupExecResult("");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.isGitRepo).toBe(true);
      expect(status.hasChanges).toBe(false);
      expect(status.branch).toBeNull();
    });

    it("reports isGitRepo=false when the git command fails", async () => {
      setupExecError(new Error("fatal: not a git repository"));
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.isGitRepo).toBe(false);
      expect(status.branch).toBeNull();
      expect(status.hasChanges).toBe(false);
    });

    it("ignores porcelain lines shorter than the status prefix", async () => {
      setupExecResult("## main\nXY\n");
      const git = createGitService({ cwd: "/test" });

      const status = await git.getStatus();

      expect(status.files.staged).toEqual([]);
      expect(status.files.unstaged).toEqual([]);
    });
  });

  describe("isGitInstalled", () => {
    it("returns true when the git binary responds", async () => {
      setupExecResult("git version 2.40.0");
      const git = createGitService();

      expect(await git.isGitInstalled()).toBe(true);
    });

    it("returns false when the git binary is missing", async () => {
      setupExecError(new Error("ENOENT"));
      const git = createGitService();

      expect(await git.isGitInstalled()).toBe(false);
    });
  });

  describe("getDiff", () => {
    it.each([
      { mode: "staged" as const, expectedArgs: ["diff", "--cached"] },
      { mode: "unstaged" as const, expectedArgs: ["diff"] },
      { mode: "files" as const, expectedArgs: ["diff"] },
    ])("returns diff output for mode=$mode and invokes git with $expectedArgs", async ({ mode, expectedArgs }) => {
      const diffOutput = "diff --git a/file.ts b/file.ts\n";
      setupExecResult(diffOutput);
      const git = createGitService({ cwd: "/test" });

      const result = await git.getDiff(mode);

      expect(result).toBe(diffOutput);
      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "git",
        expectedArgs,
        expect.objectContaining({ cwd: "/test" }),
      );
    });

    it("returns an empty string when git produces no diff output", async () => {
      setupExecResult("");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getDiff();

      expect(result).toBe("");
    });
  });

  describe("getBlame", () => {
    it("returns author, commit, and summary from porcelain blame output", async () => {
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

    it("returns null when the blame command fails", async () => {
      setupExecError(new Error("fatal: no such path"));
      const git = createGitService({ cwd: "/test" });

      const blame = await git.getBlame("nonexistent.ts", 1);

      expect(blame).toBeNull();
    });
  });

  describe("getFileLines", () => {
    it("returns the requested 1-based inclusive line slice", async () => {
      const fileContent = "line1\nline2\nline3\nline4\nline5";
      setupExecResult(fileContent);
      const git = createGitService({ cwd: "/test" });

      const lines = await git.getFileLines("src/file.ts", 2, 4);

      expect(lines).toEqual(["line2", "line3", "line4"]);
    });

    it("returns an empty array when the requested range falls past the file end", async () => {
      const fileContent = "line1\nline2";
      setupExecResult(fileContent);
      const git = createGitService({ cwd: "/test" });

      const lines = await git.getFileLines("src/file.ts", 5, 10);

      expect(lines).toEqual([]);
    });

    it("returns an empty array when the underlying command fails", async () => {
      setupExecError(new Error("fatal: path not found"));
      const git = createGitService({ cwd: "/test" });

      const lines = await git.getFileLines("nonexistent.ts", 1, 5);

      expect(lines).toEqual([]);
    });
  });

  describe("getHeadCommit", () => {
    it("returns the trimmed commit hash on success", async () => {
      setupExecResult("abc123def456\n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getHeadCommit();

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("abc123def456");
      }
    });

    it("returns an error result when stdout is blank", async () => {
      setupExecResult("  \n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getHeadCommit();

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("Empty commit hash");
      }
    });

    it("returns an error result when the rev-parse command fails", async () => {
      setupExecError(new Error("fatal: not a git repo"));
      const git = createGitService({ cwd: "/test" });

      const result = await git.getHeadCommit();

      expect(result.ok).toBe(false);
    });
  });

  describe("getStatusHash", () => {
    it("returns a 16-char hex hash when the working tree has changes", async () => {
      setupExecResult(" M file1.ts\n M file2.ts\n");
      const git = createGitService({ cwd: "/test" });

      const hash = await git.getStatusHash();

      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it("returns an empty string when there are no changes", async () => {
      setupExecResult("");
      const git = createGitService({ cwd: "/test" });

      const hash = await git.getStatusHash();

      expect(hash).toBe("");
    });

    it("treats workspace-only .diffgazer changes as no changes", async () => {
      setupExecResult("?? .diffgazer/context.md\n?? .diffgazer/context.json\n");
      const git = createGitService({ cwd: "/test" });

      const hash = await git.getStatusHash();

      expect(hash).toBe("");
    });

    it("hashes user changes even when .diffgazer files are also present", async () => {
      setupExecResult(" M src/app.ts\n?? .diffgazer/context.md\n");
      const git = createGitService({ cwd: "/test" });

      const hash = await git.getStatusHash();

      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it.each([
      { description: "similarly named top-level directories", output: " M .diffgazer-backup/config.json\n" },
      { description: "nested .diffgazer directories", output: " M src/.diffgazer/config.json\n" },
    ])("includes $description in the hash", async ({ output }) => {
      setupExecResult(output);
      const git = createGitService({ cwd: "/test" });

      const hash = await git.getStatusHash();

      expect(hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it("returns an empty string when the underlying command fails", async () => {
      setupExecError(new Error("git error"));
      const git = createGitService({ cwd: "/test" });

      const hash = await git.getStatusHash();

      expect(hash).toBe("");
    });
  });
});
