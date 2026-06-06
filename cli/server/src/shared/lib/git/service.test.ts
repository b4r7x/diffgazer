import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExecFileAsync, mockReadFile, mockRealpath, mockLstat } = vi.hoisted(() => ({
  mockExecFileAsync: vi.fn(),
  mockReadFile: vi.fn(),
  mockRealpath: vi.fn(),
  mockLstat: vi.fn(),
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

// Boundary mock: node:fs/promises for worktree file reads and path traversal checks
vi.mock("node:fs/promises", () => ({
  readFile: mockReadFile,
  realpath: mockRealpath,
  lstat: mockLstat,
}));

import { createGitService } from "./service.js";

function setupExecResult(stdout: string) {
  mockExecFileAsync.mockResolvedValue({ stdout, stderr: "" });
}

function setupExecError(error: Error) {
  mockExecFileAsync.mockRejectedValue(error);
}

function setupWorktreeFileRead(_cwd: string, _filePath: string, content: string) {
  mockRealpath.mockImplementation(async (p: string) => p);
  mockLstat.mockResolvedValue({ isFile: () => true });
  mockReadFile.mockResolvedValue(content);
}

describe("createGitService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getStatus", () => {
    it("reports a clean repo with branch and remote tracking", async () => {
      setupExecResult("## main...origin/main\n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.isGitRepo).toBe(true);
      expect(result.value.branch).toBe("main");
      expect(result.value.remoteBranch).toBe("origin/main");
      expect(result.value.ahead).toBe(0);
      expect(result.value.behind).toBe(0);
      expect(result.value.hasChanges).toBe(false);
      expect(result.value.files.staged).toEqual([]);
      expect(result.value.files.unstaged).toEqual([]);
      expect(result.value.files.untracked).toEqual([]);
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

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.branch).toBe(branch);
      expect(result.value.remoteBranch).toBe(remoteBranch);
      expect(result.value.ahead).toBe(ahead);
      expect(result.value.behind).toBe(behind);
    });

    it.each([
      { kind: "staged modified", output: "## main\nM  src/file.ts\n", path: "src/file.ts", indexStatus: "M", group: "staged" as const },
      { kind: "staged added", output: "## main\nA  new-file.ts\n", path: "new-file.ts", indexStatus: "A", group: "staged" as const },
      { kind: "staged deleted", output: "## main\nD  old-file.ts\n", path: "old-file.ts", indexStatus: "D", group: "staged" as const },
    ])("places $kind file in the staged bucket", async ({ output, path, indexStatus }) => {
      setupExecResult(output);
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.hasChanges).toBe(true);
      expect(result.value.files.staged).toHaveLength(1);
      expect(result.value.files.staged[0]?.path).toBe(path);
      expect(result.value.files.staged[0]?.indexStatus).toBe(indexStatus);
    });

    it("places worktree-only changes in the unstaged bucket", async () => {
      setupExecResult("## main\n M src/file.ts\n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.hasChanges).toBe(true);
      expect(result.value.files.unstaged).toHaveLength(1);
      expect(result.value.files.unstaged[0]?.path).toBe("src/file.ts");
      expect(result.value.files.unstaged[0]?.workTreeStatus).toBe("M");
    });

    it("places ?? files in the untracked bucket without flagging hasChanges", async () => {
      setupExecResult("## main\n?? new-file.ts\n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.hasChanges).toBe(false);
      expect(result.value.files.untracked).toHaveLength(1);
      expect(result.value.files.untracked[0]?.path).toBe("new-file.ts");
    });

    it("reports UU entries as conflicted files", async () => {
      setupExecResult("## main\nUU conflicted.ts\n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.conflicted).toContain("conflicted.ts");
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

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.files.staged).toHaveLength(2);
      expect(result.value.files.unstaged).toHaveLength(1);
      expect(result.value.files.untracked).toHaveLength(1);
      expect(result.value.hasChanges).toBe(true);
    });

    it("reports no changes for an empty porcelain output", async () => {
      setupExecResult("");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.isGitRepo).toBe(true);
      expect(result.value.hasChanges).toBe(false);
      expect(result.value.branch).toBeNull();
    });

    it("returns an error when the git command fails", async () => {
      setupExecError(new Error("fatal: not a git repository"));
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("not a git repository");
    });

    it("ignores porcelain lines shorter than the status prefix", async () => {
      setupExecResult("## main\nXY\n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.files.staged).toEqual([]);
      expect(result.value.files.unstaged).toEqual([]);
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
      { mode: "staged" as const, expectedArgs: ["diff", "--cached", "--no-ext-diff", "--no-textconv", "--no-color"] },
      { mode: "unstaged" as const, expectedArgs: ["diff", "--no-ext-diff", "--no-textconv", "--no-color"] },
      { mode: "files" as const, expectedArgs: ["diff", "--no-ext-diff", "--no-textconv", "--no-color"] },
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
      expect(blame?.author).toBe("John Doe");
      expect(blame?.authorEmail).toBe("john@example.com");
      expect(blame?.commit).toBe("abc1234");
      expect(blame?.summary).toBe("Fix the bug");
      expect(blame?.commitDate).toBe(new Date(1700000000 * 1000).toISOString());
    });

    it("passes the -- sentinel before the file path to prevent option injection", async () => {
      setupExecResult("abc1234 1 1 1\nauthor Test\nauthor-mail <t@t.com>\nauthor-time 0\nsummary s\n");
      const git = createGitService({ cwd: "/test" });

      await git.getBlame("--malicious-file.ts", 1);

      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "git",
        expect.arrayContaining(["--", "--malicious-file.ts"]),
        expect.anything(),
      );
    });

    it("returns null when the blame command fails", async () => {
      setupExecError(new Error("fatal: no such path"));
      const git = createGitService({ cwd: "/test" });

      const blame = await git.getBlame("nonexistent.ts", 1);

      expect(blame).toBeNull();
    });
  });

  describe("getFileLines", () => {
    it("reads from the worktree by default", async () => {
      const fileContent = "line1\nline2\nline3\nline4\nline5";
      setupWorktreeFileRead("/test", "/test/src/file.ts", fileContent);
      const git = createGitService({ cwd: "/test" });

      const lines = await git.getFileLines("src/file.ts", 2, 4);

      expect(lines).toEqual(["line2", "line3", "line4"]);
      expect(mockReadFile).toHaveBeenCalledWith("/test/src/file.ts", "utf-8");
      expect(mockExecFileAsync).not.toHaveBeenCalled();
    });

    it("reads from HEAD when source is explicitly HEAD", async () => {
      const fileContent = "line1\nline2\nline3\nline4\nline5";
      setupExecResult(fileContent);
      const git = createGitService({ cwd: "/test" });

      const lines = await git.getFileLines("src/file.ts", 2, 4, "HEAD");

      expect(lines).toEqual(["line2", "line3", "line4"]);
      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "git",
        ["show", "HEAD:src/file.ts"],
        expect.anything(),
      );
    });

    it("returns an empty array when the requested range falls past the file end", async () => {
      const fileContent = "line1\nline2";
      setupExecResult(fileContent);
      const git = createGitService({ cwd: "/test" });

      const lines = await git.getFileLines("src/file.ts", 5, 10, "HEAD");

      expect(lines).toEqual([]);
    });

    it("returns an empty array when the underlying command fails", async () => {
      setupExecError(new Error("fatal: path not found"));
      const git = createGitService({ cwd: "/test" });

      const lines = await git.getFileLines("nonexistent.ts", 1, 5, "HEAD");

      expect(lines).toEqual([]);
    });

    it("returns an empty array when worktree file read fails", async () => {
      mockRealpath.mockImplementation(async (p: string) => p);
      mockLstat.mockResolvedValue({ isFile: () => true });
      mockReadFile.mockRejectedValue(new Error("ENOENT"));
      const git = createGitService({ cwd: "/test" });

      const lines = await git.getFileLines("nonexistent.ts", 1, 5);

      expect(lines).toEqual([]);
    });

    it("returns empty for path traversal via ../../etc/passwd", async () => {
      mockRealpath.mockImplementation(async (p: string) => {
        if (p === "/test") return "/test";
        if (p === "/etc/passwd") return "/etc/passwd";
        return p;
      });
      const git = createGitService({ cwd: "/test" });

      const lines = await git.getFileLines("../../etc/passwd", 1, 5);

      expect(lines).toEqual([]);
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it("returns empty for a symlink that resolves outside cwd", async () => {
      mockRealpath.mockImplementation(async (p: string) => {
        if (p === "/test") return "/test";
        if (p === "/test/link.ts") return "/outside/secret.ts";
        return p;
      });
      const git = createGitService({ cwd: "/test" });

      const lines = await git.getFileLines("link.ts", 1, 5);

      expect(lines).toEqual([]);
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it("returns empty for a FIFO (non-regular file)", async () => {
      mockRealpath.mockImplementation(async (p: string) => p);
      mockLstat.mockResolvedValue({ isFile: () => false });
      const git = createGitService({ cwd: "/test" });

      const lines = await git.getFileLines("src/fifo", 1, 5);

      expect(lines).toEqual([]);
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it("returns empty when realpath of file fails and resolved path escapes cwd", async () => {
      mockRealpath.mockImplementation(async (p: string) => {
        if (p === "/test") return "/test";
        throw new Error("ENOENT");
      });
      const git = createGitService({ cwd: "/test" });

      const lines = await git.getFileLines("../../etc/shadow", 1, 5);

      expect(lines).toEqual([]);
      expect(mockReadFile).not.toHaveBeenCalled();
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

  describe("git environment hardening", () => {
    it("clears GIT_EXTERNAL_DIFF from the environment", async () => {
      process.env.GIT_EXTERNAL_DIFF = "/usr/bin/malicious-diff";
      setupExecResult("## main\n");
      const git = createGitService({ cwd: "/test" });

      await git.getStatus();

      const callEnv = mockExecFileAsync.mock.calls[0]?.[2]?.env;
      expect(callEnv?.GIT_EXTERNAL_DIFF).toBe("");
      delete process.env.GIT_EXTERNAL_DIFF;
    });

    it("clears GIT_PAGER from the environment", async () => {
      process.env.GIT_PAGER = "less";
      setupExecResult("diff --git a/f.ts b/f.ts\n");
      const git = createGitService({ cwd: "/test" });

      await git.getDiff();

      const callEnv = mockExecFileAsync.mock.calls[0]?.[2]?.env;
      expect(callEnv?.GIT_PAGER).toBe("");
      delete process.env.GIT_PAGER;
    });

    it("uses -- sentinel in blame to prevent option injection", async () => {
      const porcelainOutput = [
        "abc1234 1 1 1",
        "author John",
        "author-mail <j@x.com>",
        "author-time 1700000000",
        "summary Fix",
        "\tcode",
      ].join("\n");
      setupExecResult(porcelainOutput);
      const git = createGitService({ cwd: "/test" });

      await git.getBlame("src/file.ts", 1);

      const args = mockExecFileAsync.mock.calls[0]?.[1];
      expect(args).toContain("--");
      const dashDashIndex = args?.indexOf("--");
      const fileIndex = args?.indexOf("src/file.ts");
      expect(dashDashIndex).toBeLessThan(fileIndex);
    });

    it("passes --no-ext-diff --no-textconv --no-color for diff commands", async () => {
      setupExecResult("diff --git a/f.ts b/f.ts\n");
      const git = createGitService({ cwd: "/test" });

      await git.getDiff("unstaged");

      const args = mockExecFileAsync.mock.calls[0]?.[1] as string[];
      expect(args).toContain("--no-ext-diff");
      expect(args).toContain("--no-textconv");
      expect(args).toContain("--no-color");
    });

    it("passes --no-optional-locks and fsmonitor=false for status", async () => {
      setupExecResult("## main\n");
      const git = createGitService({ cwd: "/test" });

      await git.getStatus();

      const args = mockExecFileAsync.mock.calls[0]?.[1] as string[];
      expect(args).toContain("--no-optional-locks");
      expect(args).toContain("core.fsmonitor=false");
    });

    it.each([
      "GIT_DIFF_OPTS",
      "GIT_DIR",
      "GIT_WORK_TREE",
      "GIT_INDEX_FILE",
      "GIT_CONFIG",
      "GIT_CONFIG_GLOBAL",
      "GIT_CONFIG_SYSTEM",
      "GIT_CONFIG_COUNT",
      "GIT_CONFIG_PARAMETERS",
      "GIT_ALTERNATE_OBJECT_DIRECTORIES",
      "GIT_OBJECT_DIRECTORY",
      "GIT_CEILING_DIRECTORIES",
      "GIT_EXEC_PATH",
      "GIT_SSH_COMMAND",
      "GIT_ASKPASS",
      "GIT_PROXY_COMMAND",
      "GIT_HOOKS_PATH",
      "GIT_TEMPLATE_DIR",
    ])("clears %s from the environment to prevent parent pollution", async (envVar) => {
      process.env[envVar] = "/some/polluted/value";
      setupExecResult("## main\n");
      const git = createGitService({ cwd: "/test" });

      await git.getStatus();

      const callEnv = mockExecFileAsync.mock.calls[0]?.[2]?.env;
      expect(callEnv?.[envVar]).toBe("");
      delete process.env[envVar];
    });
  });

  describe(".diffgazer filtering in status", () => {
    it("excludes .diffgazer/ files from status results", async () => {
      setupExecResult("## main\n?? .diffgazer/project.json\n M src/app.ts\n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.files.untracked).toHaveLength(0);
      expect(result.value.files.unstaged).toHaveLength(1);
      expect(result.value.files.unstaged[0]?.path).toBe("src/app.ts");
    });

    it("reports no changes when only .diffgazer/ files are changed", async () => {
      setupExecResult("## main\n?? .diffgazer/context.md\nA  .diffgazer/project.json\n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.hasChanges).toBe(false);
      expect(result.value.files.staged).toHaveLength(0);
      expect(result.value.files.untracked).toHaveLength(0);
    });

    it("keeps non-.diffgazer files with similar names", async () => {
      setupExecResult("## main\n?? .diffgazer-backup/config.json\n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.files.untracked).toHaveLength(1);
      // Untracked files are preserved but do not flag hasChanges (P2 design)
      expect(result.value.hasChanges).toBe(false);
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

    it("returns null when the underlying command fails", async () => {
      setupExecError(new Error("git error"));
      const git = createGitService({ cwd: "/test" });

      const hash = await git.getStatusHash();

      expect(hash).toBeNull();
    });
  });
});
