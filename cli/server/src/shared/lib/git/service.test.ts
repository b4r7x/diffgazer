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

/** NUL-delimited porcelain=v2 --branch -z shapes matching `git status` subprocess output. */
const PORCELAIN_V2 = {
  branchHead: (head: string) => `# branch.head ${head}`,
  stagedAdded: (path: string) =>
    `1 A. N... 000000 100644 100644 0000000000000000000000000000000000000000 b4785957bc986dc39c629de9fac9df46972c00fc ${path}`,
  worktreeModified: (path: string) =>
    `1 .M N... 100644 100644 100644 df967b96a579e45a18b8251732d16804b2e56a55 df967b96a579e45a18b8251732d16804b2e56a55 ${path}`,
  untracked: (path: string) => `? ${path}`,
  renameStaged: (path: string, score: string) =>
    `2 R. N... 100644 100644 100644 587be6b4c3f93f93c489c0111bba5596147a26cb 587be6b4c3f93f93c489c0111bba5596147a26cb ${score} ${path}`,
  unmergedBothAdded: (path: string) =>
    `u AA N... 000000 100644 100644 100644 0000000000000000000000000000000000000000 13e7564ea0c889e81bcba6f8e496b2a74cdb32fa 718f4d2ff533cf8ead8d3556cf43912bd245fbc4 ${path}`,
} as const;

function setupExecError(error: Error) {
  mockExecFileAsync.mockRejectedValue(error);
}

describe("createGitService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("getStatus", () => {
    it("sets hasChanges when staged or unstaged files remain after parsing", async () => {
      setupStatusResult(
        PORCELAIN_V2.branchHead("main"),
        PORCELAIN_V2.stagedAdded("staged.ts"),
        PORCELAIN_V2.untracked("untracked.ts"),
      );
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.branch).toBe("main");
      expect(result.value.hasChanges).toBe(true);
      expect(result.value.files.staged).toHaveLength(1);
      expect(result.value.files.staged[0]?.path).toBe("staged.ts");
      expect(result.value.files.untracked).toHaveLength(1);
      expect(result.value.files.untracked[0]?.path).toBe("untracked.ts");
    });

    it("parses v2 ordinary, rename, and unmerged records into buckets", async () => {
      setupStatusResult(
        PORCELAIN_V2.branchHead("main"),
        PORCELAIN_V2.worktreeModified("tracked.txt"),
        PORCELAIN_V2.renameStaged("new.txt", "R100"),
        "old.txt",
        PORCELAIN_V2.unmergedBothAdded("c.txt"),
      );
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.hasChanges).toBe(true);
      expect(result.value.files.unstaged).toContainEqual({
        path: "tracked.txt",
        indexStatus: " ",
        workTreeStatus: "M",
      });
      expect(result.value.files.staged).toContainEqual({
        path: "new.txt",
        previousPath: "old.txt",
        indexStatus: "R",
        workTreeStatus: " ",
      });
      expect(result.value.conflicted).toEqual(["c.txt"]);
    });

    it("does not flag hasChanges for untracked-only porcelain", async () => {
      setupStatusResult(PORCELAIN_V2.branchHead("main"), PORCELAIN_V2.untracked("new-file.ts"));
      const git = createGitService({ cwd: "/test" });

      const result = await git.getStatus();

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.value.hasChanges).toBe(false);
      expect(result.value.files.untracked[0]?.path).toBe("new-file.ts");
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

    it.each([
      {
        description: "unknown revision",
        stderr: "fatal: unknown revision or path not in the working tree.",
      },
      { description: "bad default revision", stderr: "fatal: bad default revision 'HEAD'" },
    ])("returns the UNBORN sentinel for $description stderr", async ({ stderr }) => {
      setupExecError(new Error(stderr));
      const git = createGitService({ cwd: "/test" });

      const result = await git.getHeadCommit();

      expect(result).toEqual({ ok: true, value: "UNBORN" });
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
      // reads the repo or refreshes the index.
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
      // fail `fatal: not a git repository: ''`.
      expect(envVar in (callEnv ?? {})).toBe(false);
      delete process.env[envVar];
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
