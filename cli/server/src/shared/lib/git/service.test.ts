import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExecFileAsync } = vi.hoisted(() => ({
  mockExecFileAsync: vi.fn(),
}));

// Boundary mock: node:child_process is the Node.js external-process boundary; createGitService spawns the `git` CLI, so tests stub execFile to provide canned stdout/stderr.
vi.mock("node:child_process", () => {
  const execFileFn = Object.assign(
    (...args: unknown[]) => {
      const cb = args[args.length - 1];
      if (typeof cb === "function")
        (cb as (err: null, stdout: string, stderr: string) => void)(null, "", "");
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
    ])("parses branch header with $scenario", async ({
      output,
      branch,
      remoteBranch,
      ahead,
      behind,
    }) => {
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
      {
        kind: "staged modified",
        output: "## main\nM  src/file.ts\n",
        path: "src/file.ts",
        indexStatus: "M",
        group: "staged" as const,
      },
      {
        kind: "staged added",
        output: "## main\nA  new-file.ts\n",
        path: "new-file.ts",
        indexStatus: "A",
        group: "staged" as const,
      },
      {
        kind: "staged deleted",
        output: "## main\nD  old-file.ts\n",
        path: "old-file.ts",
        indexStatus: "D",
        group: "staged" as const,
      },
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

    it("decodes a git-quoted non-ASCII porcelain path to the correct string", async () => {
      // git quotes `żółć/plik.ts` as octal bytes under default core.quotepath.
      const quoted = '"\\305\\274\\303\\263\\305\\202\\304\\207/plik.ts"';
      setupExecResult(`## main\n M ${quoted}\n`);
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.files.unstaged[0]?.path).toBe("żółć/plik.ts");
    });

    it("excludes a git-quoted .diffgazer non-ASCII path from status results", async () => {
      const quoted = '".diffgazer/\\305\\274.json"';
      setupExecResult(`## main\n M ${quoted}\n M src/app.ts\n`);
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.files.unstaged).toHaveLength(1);
      expect(result.value.files.unstaged[0]?.path).toBe("src/app.ts");
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
      {
        mode: "staged" as const,
        expectedArgs: ["diff", "--cached", "--no-ext-diff", "--no-textconv", "--no-color"],
      },
      {
        mode: "unstaged" as const,
        expectedArgs: ["diff", "--no-ext-diff", "--no-textconv", "--no-color"],
      },
      {
        mode: "files" as const,
        expectedArgs: ["diff", "--no-ext-diff", "--no-textconv", "--no-color"],
      },
    ])("returns diff output for mode=$mode and invokes git with $expectedArgs", async ({
      mode,
      expectedArgs,
    }) => {
      const diffOutput = "diff --git a/file.ts b/file.ts\n";
      setupExecResult(diffOutput);
      const git = createGitService({ cwd: "/test" });

      const result = await git.getDiff(mode);

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBe(diffOutput);
      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "git",
        expect.arrayContaining(expectedArgs),
        expect.objectContaining({ cwd: "/test" }),
      );
    });

    it("returns an empty string when git produces no diff output", async () => {
      setupExecResult("");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getDiff();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toBe("");
    });

    it("returns an error result when the diff command fails", async () => {
      setupExecError(new Error("fatal: not a git repository"));
      const git = createGitService({ cwd: "/test" });

      const result = await git.getDiff();

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("not a git repository");
    });

    it("hardens every diff invocation with fsmonitor and optional-lock overrides", async () => {
      setupExecResult("diff --git a/f.ts b/f.ts\n");
      const git = createGitService({ cwd: "/test" });

      await git.getDiff("unstaged");

      const args = mockExecFileAsync.mock.calls[0]?.[1] as string[];
      expect(args).toContain("core.fsmonitor=false");
      expect(args).toContain("--no-optional-locks");
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
    it("unsets GIT_EXTERNAL_DIFF from the environment", async () => {
      process.env.GIT_EXTERNAL_DIFF = "/usr/bin/malicious-diff";
      setupExecResult("## main\n");
      const git = createGitService({ cwd: "/test" });

      await git.getStatus();

      const callEnv = mockExecFileAsync.mock.calls[0]?.[2]?.env;
      expect(callEnv).toBeDefined();
      expect("GIT_EXTERNAL_DIFF" in (callEnv ?? {})).toBe(false);
      delete process.env.GIT_EXTERNAL_DIFF;
    });

    it("unsets GIT_PAGER from the environment", async () => {
      process.env.GIT_PAGER = "less";
      setupExecResult("diff --git a/f.ts b/f.ts\n");
      const git = createGitService({ cwd: "/test" });

      await git.getDiff();

      const callEnv = mockExecFileAsync.mock.calls[0]?.[2]?.env;
      expect(callEnv).toBeDefined();
      expect("GIT_PAGER" in (callEnv ?? {})).toBe(false);
      delete process.env.GIT_PAGER;
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

    it("hardens every index-touching git invocation, exempting only the --version probe", async () => {
      // Exercise every public method that spawns git so each execFile("git", …)
      // site is recorded, then assert the hardened base args are uniform — the
      // only allowed exemption is the `git --version` install probe, which never
      // reads the repo or refreshes the index (F-223).
      setupExecResult(" M file.ts\n");
      const git = createGitService({ cwd: "/test" });

      await git.getStatus();
      await git.getDiff("unstaged");
      await git.getDiff("staged");
      await git.getHeadCommit();
      await git.getStatusHash();
      await git.isGitInstalled();

      const gitCalls = mockExecFileAsync.mock.calls.filter((call) => call[0] === "git");
      expect(gitCalls.length).toBeGreaterThan(0);

      for (const call of gitCalls) {
        const args = call[1] as string[];
        if (args.includes("--version")) {
          expect(args).toEqual(["--version"]);
          continue;
        }
        expect(args).toContain("core.fsmonitor=false");
        expect(args).toContain("--no-optional-locks");
      }
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
    ])("unsets %s from the environment to prevent parent pollution", async (envVar) => {
      process.env[envVar] = "/some/polluted/value";
      setupExecResult("## main\n");
      const git = createGitService({ cwd: "/test" });

      await git.getStatus();

      const callEnv = mockExecFileAsync.mock.calls[0]?.[2]?.env;
      expect(callEnv).toBeDefined();
      // The key must be absent (deleted), not blanked — an empty GIT_DIR makes git
      // fail `fatal: not a git repository: ''` (F-001).
      expect(envVar in (callEnv ?? {})).toBe(false);
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
    it("returns a full-kind 16-char hex hash when the working tree has changes", async () => {
      setupExecResult(" M file1.ts\n M file2.ts\n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatusHash();

      expect(result.kind).toBe("full");
      if (result.kind === "unavailable") return;
      expect(result.hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it("returns a full-kind empty string when there are no changes", async () => {
      setupExecResult("");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatusHash();

      expect(result).toEqual({ kind: "full", hash: "" });
    });

    it("treats workspace-only .diffgazer changes as no changes", async () => {
      setupExecResult("?? .diffgazer/context.md\n?? .diffgazer/context.json\n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatusHash();

      expect(result).toEqual({ kind: "full", hash: "" });
    });

    it("hashes user changes even when .diffgazer files are also present", async () => {
      setupExecResult(" M src/app.ts\n?? .diffgazer/context.md\n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatusHash();

      expect(result.kind).toBe("full");
      if (result.kind === "unavailable") return;
      expect(result.hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it.each([
      {
        description: "similarly named top-level directories",
        output: " M .diffgazer-backup/config.json\n",
      },
      { description: "nested .diffgazer directories", output: " M src/.diffgazer/config.json\n" },
    ])("includes $description in the hash", async ({ output }) => {
      setupExecResult(output);
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatusHash();

      expect(result.kind).toBe("full");
      if (result.kind === "unavailable") return;
      expect(result.hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it("degrades to status-only when the inner diff read fails", async () => {
      // First call (status) succeeds with changes; the diff reads reject.
      mockExecFileAsync
        .mockResolvedValueOnce({ stdout: " M file1.ts\n", stderr: "" })
        .mockRejectedValue(new Error("stdout maxBuffer length exceeded"));
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatusHash();

      expect(result.kind).toBe("status-only");
      if (result.kind === "unavailable") return;
      expect(result.hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it("returns unavailable when the status command fails", async () => {
      setupExecError(new Error("git error"));
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatusHash();

      expect(result).toEqual({ kind: "unavailable" });
    });
  });
});
