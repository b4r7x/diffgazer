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

function setupStatusResult(...records: string[]) {
  setupExecResult(records.length > 0 ? `${records.join("\0")}\0` : "");
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
      setupStatusResult("## main...origin/main");
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
        output: ["## feature...origin/feature [ahead 3, behind 2]"],
        branch: "feature",
        remoteBranch: "origin/feature",
        ahead: 3,
        behind: 2,
      },
      {
        scenario: "only ahead count",
        output: ["## main...origin/main [ahead 5]"],
        branch: "main",
        remoteBranch: "origin/main",
        ahead: 5,
        behind: 0,
      },
      {
        scenario: "no remote tracking",
        output: ["## feature-branch"],
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
      setupStatusResult(...output);
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
        output: ["## main", "M  src/file.ts"],
        path: "src/file.ts",
        indexStatus: "M",
        group: "staged" as const,
      },
      {
        kind: "staged added",
        output: ["## main", "A  new-file.ts"],
        path: "new-file.ts",
        indexStatus: "A",
        group: "staged" as const,
      },
      {
        kind: "staged deleted",
        output: ["## main", "D  old-file.ts"],
        path: "old-file.ts",
        indexStatus: "D",
        group: "staged" as const,
      },
    ])("places $kind file in the staged bucket", async ({ output, path, indexStatus }) => {
      setupStatusResult(...output);
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
      setupStatusResult("## main", " M src/file.ts");
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
      setupStatusResult("## main", "?? new-file.ts");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.hasChanges).toBe(false);
      expect(result.value.files.untracked).toHaveLength(1);
      expect(result.value.files.untracked[0]?.path).toBe("new-file.ts");
    });

    it.each([
      ["DD", "both deleted"],
      ["AU", "added by us"],
      ["UD", "deleted by them"],
      ["UA", "added by them"],
      ["DU", "deleted by us"],
      ["AA", "both added"],
      ["UU", "both modified"],
    ])("reports %s (%s) entries as conflicted files", async (status) => {
      setupStatusResult("## main", `${status} conflicted.ts`);
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.conflicted).toEqual(["conflicted.ts"]);
    });

    it("splits mixed-status entries into the correct buckets", async () => {
      const output = [
        "## main...origin/main",
        "M  staged.ts",
        " M unstaged.ts",
        "?? untracked.ts",
        "A  added.ts",
      ];
      setupStatusResult(...output);
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
      setupStatusResult();
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.isGitRepo).toBe(true);
      expect(result.value.hasChanges).toBe(false);
      expect(result.value.branch).toBeNull();
    });

    it("returns isGitRepo false for a non-repository directory", async () => {
      setupExecError(
        new Error("fatal: not a git repository (or any of the parent directories): .git"),
      );
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value).toEqual({
        isGitRepo: false,
        branch: null,
        remoteBranch: null,
        ahead: 0,
        behind: 0,
        files: { staged: [], unstaged: [], untracked: [] },
        hasChanges: false,
        conflicted: [],
      });
    });

    it("returns an error when the git command fails for another reason", async () => {
      setupExecError(new Error("fatal: index file corrupt"));
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.message).toContain("index file corrupt");
    });

    it("ignores porcelain records shorter than the status prefix", async () => {
      setupStatusResult("## main", "XY");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.files.staged).toEqual([]);
      expect(result.value.files.unstaged).toEqual([]);
    });

    it("preserves a non-ASCII porcelain path", async () => {
      setupStatusResult("## main", " M żółć/plik.ts");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.files.unstaged[0]?.path).toBe("żółć/plik.ts");
    });

    it("parses a staged rename into path and previousPath", async () => {
      setupStatusResult("## main", "R  new.txt", "old.txt");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.files.staged[0]).toMatchObject({
        path: "new.txt",
        previousPath: "old.txt",
        indexStatus: "R",
        workTreeStatus: " ",
      });
    });

    it("parses a rename with spaces", async () => {
      setupStatusResult("## main", "R  c d.txt", "a b.txt");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.files.staged[0]?.path).toBe("c d.txt");
      expect(result.value.files.staged[0]?.previousPath).toBe("a b.txt");
    });

    it("preserves a leading/trailing space in a filename", async () => {
      setupStatusResult("## main", " M  report .md ");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.files.unstaged[0]?.path).toBe(" report .md ");
    });

    it("preserves a leading/trailing space in a rename's paths", async () => {
      setupStatusResult("## main", "R  new.txt ", " old.txt");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.files.staged[0]?.path).toBe("new.txt ");
      expect(result.value.files.staged[0]?.previousPath).toBe(" old.txt");
    });

    it("excludes a .diffgazer non-ASCII path from status results", async () => {
      setupStatusResult("## main", " M .diffgazer/ż.json", " M src/app.ts");
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

    it("requires a non-empty explicit pathspec for files mode before spawning git", async () => {
      const git = createGitService({ cwd: "/test" });

      const result = await git.getDiff("files", []);

      expect(result).toEqual({
        ok: false,
        error: { message: "files diff mode requires at least one pathspec" },
      });
      expect(mockExecFileAsync).not.toHaveBeenCalled();
    });

    it("passes explicit files mode pathspecs after the git separator", async () => {
      setupExecResult("diff --git a/src/file.ts b/src/file.ts\n");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getDiff("files", ["src/file.ts"]);

      expect(result.ok).toBe(true);
      const args = mockExecFileAsync.mock.calls[0]?.[1] as string[];
      expect(args.slice(-2)).toEqual(["--", "src/file.ts"]);
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

    it("passes the signal to git and rejects when a pending diff is aborted", async () => {
      const controller = new AbortController();
      mockExecFileAsync.mockImplementationOnce(
        async (_command: string, _args: string[], options: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            options.signal?.addEventListener(
              "abort",
              () => reject(new DOMException("The operation was aborted", "AbortError")),
              { once: true },
            );
          }),
      );
      const git = createGitService({ cwd: "/test" });

      const result = git.getDiff("unstaged", undefined, controller.signal);
      expect(mockExecFileAsync).toHaveBeenCalledWith(
        "git",
        expect.any(Array),
        expect.objectContaining({ signal: controller.signal }),
      );

      controller.abort();

      await expect(result).rejects.toMatchObject({ name: "AbortError" });
    });

    it("does not spawn git for an already-aborted diff", async () => {
      const controller = new AbortController();
      controller.abort();
      const git = createGitService({ cwd: "/test" });

      await expect(git.getDiff("unstaged", undefined, controller.signal)).rejects.toMatchObject({
        name: "AbortError",
      });
      expect(mockExecFileAsync).not.toHaveBeenCalled();
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
      setupStatusResult("## main");
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
      setupStatusResult("## main");
      const git = createGitService({ cwd: "/test" });

      await git.getStatus();

      const args = mockExecFileAsync.mock.calls[0]?.[1] as string[];
      expect(args).toContain("--no-optional-locks");
      expect(args).toContain("core.fsmonitor=false");
      expect(args).toContain("--porcelain=v2");
      expect(args).toContain("--branch");
      expect(args).toContain("-z");
    });

    it("hardens every index-touching git invocation, exempting only the --version probe", async () => {
      // Exercise every public method that spawns git so each execFile("git", …)
      // site is recorded, then assert the hardened base args are uniform — the
      // only allowed exemption is the `git --version` install probe, which never
      // reads the repo or refreshes the index (F-223).
      setupStatusResult(" M file.ts");
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
      setupStatusResult("## main");
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
      setupStatusResult("## main", "?? .diffgazer/project.json", " M src/app.ts");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.files.untracked).toHaveLength(0);
      expect(result.value.files.unstaged).toHaveLength(1);
      expect(result.value.files.unstaged[0]?.path).toBe("src/app.ts");
    });

    it("reports no changes when only .diffgazer/ files are changed", async () => {
      setupStatusResult("## main", "?? .diffgazer/context.md", "A  .diffgazer/project.json");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.hasChanges).toBe(false);
      expect(result.value.files.staged).toHaveLength(0);
      expect(result.value.files.untracked).toHaveLength(0);
    });

    it("keeps non-.diffgazer files with similar names", async () => {
      setupStatusResult("## main", "?? .diffgazer-backup/config.json");
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
      setupStatusResult(" M file1.ts", " M file2.ts");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatusHash();

      expect(result.kind).toBe("full");
      if (result.kind === "unavailable") return;
      expect(result.hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it("returns a full-kind empty string when there are no changes", async () => {
      setupStatusResult();
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatusHash();

      expect(result).toEqual({ kind: "full", hash: "" });
    });

    it("treats workspace-only .diffgazer changes as no changes", async () => {
      setupStatusResult("?? .diffgazer/context.md", "?? .diffgazer/context.json");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatusHash();

      expect(result).toEqual({ kind: "full", hash: "" });
    });

    it("hashes user changes even when .diffgazer files are also present", async () => {
      setupStatusResult(" M src/app.ts", "?? .diffgazer/context.md");
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatusHash();

      expect(result.kind).toBe("full");
      if (result.kind === "unavailable") return;
      expect(result.hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it.each([
      {
        description: "similarly named top-level directories",
        output: " M .diffgazer-backup/config.json",
      },
      { description: "nested .diffgazer directories", output: " M src/.diffgazer/config.json" },
    ])("includes $description in the hash", async ({ output }) => {
      setupStatusResult(output);
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatusHash();

      expect(result.kind).toBe("full");
      if (result.kind === "unavailable") return;
      expect(result.hash).toMatch(/^[0-9a-f]{16}$/);
    });

    it("degrades to status-only when the inner diff read fails", async () => {
      // First call (status) succeeds with changes; the diff reads reject.
      mockExecFileAsync
        .mockResolvedValueOnce({ stdout: " M file1.ts\0", stderr: "" })
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
