import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { GitStatus } from "@diffgazer/core/schemas/git";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { log } from "../log.js";
import { parseGitStatusOutput, parseHashableStatusFiles } from "./status.js";

const execFileAsync = promisify(execFile);

const GIT_DIFF_MAX_BUFFER = 5 * 1024 * 1024;
type GitDiffMode = Exclude<ReviewMode, "files">;
type GitDiffResult = Promise<Result<string, { message: string }>>;

// Git environment variables that point git at a different repo/config/hook and
// can turn a malicious parent environment into command execution. Each is
// removed (not blanked) from the child env: an empty GIT_DIR makes git fail
// `fatal: not a git repository: ''`, while a deleted key is treated as unset.
const SANITIZED_GIT_ENV_KEYS = [
  "GIT_EXTERNAL_DIFF",
  "GIT_PAGER",
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
] as const;

// Hardening flags applied to every index-touching git invocation: disable
// fsmonitor (a malicious repo's `core.fsmonitor` is an arbitrary command git
// would run) and optional index locks. Status and diff both consult fsmonitor,
// so the override must be uniform across the service. The lone exemption is the
// `git --version` probe in isGitInstalled, which neither reads the repository
// nor refreshes the index, so fsmonitor never runs for it.
const HARDENED_BASE_ARGS = ["-c", "core.fsmonitor=false", "--no-optional-locks"] as const;

/**
 * Outcome of {@link createGitService.getStatusHash}, distinguishing three states
 * consumers must not conflate: `full` (status + diff content hashed), `status-only`
 * (the inner diff read failed, so the hash is content-blind and must only be
 * compared against another status-only hash), and `unavailable` (status itself
 * failed — repository state could not be verified, which is NOT "repo changed").
 */
export type StatusHashResult =
  | { kind: "full"; hash: string }
  | { kind: "status-only"; hash: string }
  | { kind: "unavailable" };

export function createGitService(options: { cwd?: string; timeout?: number } = {}) {
  const { cwd = process.cwd(), timeout = 10000 } = options;

  function safeEnv(): Record<string, string | undefined> {
    const env = { ...process.env };
    for (const key of SANITIZED_GIT_ENV_KEYS) {
      delete env[key];
    }
    return env;
  }

  async function isGitInstalled(): Promise<boolean> {
    try {
      await execFileAsync("git", ["--version"], { timeout });
      return true;
    } catch (error) {
      log("warn", "git_install_check_failed", { error: getErrorMessage(error) });
      return false;
    }
  }

  async function getStatus(): Promise<Result<GitStatus, { message: string }>> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        [...HARDENED_BASE_ARGS, "status", "--porcelain=v2", "--branch", "-z"],
        { cwd, timeout, env: safeEnv() },
      );
      const parsed = parseGitStatusOutput(stdout);
      const hasChanges = parsed.files.staged.length > 0 || parsed.files.unstaged.length > 0;
      return ok({ isGitRepo: true, ...parsed, hasChanges });
    } catch (error) {
      const msg = getErrorMessage(error);
      log("warn", "git_status_failed", { error: msg });
      if (msg.toLowerCase().includes("not a git repository")) {
        return ok({
          isGitRepo: false,
          branch: null,
          remoteBranch: null,
          ahead: 0,
          behind: 0,
          files: { staged: [], unstaged: [], untracked: [] },
          hasChanges: false,
          conflicted: [],
        });
      }
      return err({ message: msg });
    }
  }

  function getDiff(mode?: GitDiffMode, pathspecs?: undefined, signal?: AbortSignal): GitDiffResult;
  function getDiff(
    mode: ReviewMode,
    pathspecs: readonly string[],
    signal?: AbortSignal,
  ): GitDiffResult;
  async function getDiff(
    mode: ReviewMode = "unstaged",
    pathspecs?: readonly string[],
    signal?: AbortSignal,
  ): Promise<Result<string, { message: string }>> {
    signal?.throwIfAborted();
    if (mode === "files" && (!pathspecs || pathspecs.length === 0)) {
      return err({ message: "files diff mode requires at least one pathspec" });
    }
    const args =
      mode === "staged"
        ? [
            ...HARDENED_BASE_ARGS,
            "diff",
            "--cached",
            "--no-ext-diff",
            "--no-textconv",
            "--no-color",
          ]
        : [...HARDENED_BASE_ARGS, "diff", "--no-ext-diff", "--no-textconv", "--no-color"];
    if (pathspecs && pathspecs.length > 0) {
      args.push("--", ...pathspecs);
    }
    try {
      const { stdout } = await execFileAsync("git", args, {
        cwd,
        timeout,
        maxBuffer: GIT_DIFF_MAX_BUFFER,
        env: safeEnv(),
        signal,
      });
      signal?.throwIfAborted();
      return ok(stdout);
    } catch (error) {
      signal?.throwIfAborted();
      return err({ message: getErrorMessage(error) });
    }
  }

  async function getHeadCommit(): Promise<Result<string, { message: string }>> {
    try {
      const { stdout } = await execFileAsync("git", [...HARDENED_BASE_ARGS, "rev-parse", "HEAD"], {
        cwd,
        timeout,
        env: safeEnv(),
      });
      const commit = stdout.trim();
      if (!commit) {
        return err({ message: "Empty commit hash returned from git rev-parse HEAD" });
      }
      return ok(commit);
    } catch (error) {
      const msg = getErrorMessage(error, "");
      // Unborn HEAD (initial repo with no commits yet) — represent explicitly
      // to allow staged initial commit reviews.
      if (msg.includes("unknown revision") || msg.includes("bad default revision")) {
        return ok("UNBORN");
      }
      return err({ message: getErrorMessage(error, "Failed to get HEAD commit") });
    }
  }

  async function getStatusHash(): Promise<StatusHashResult> {
    let stdout: string;
    try {
      ({ stdout } = await execFileAsync(
        "git",
        [...HARDENED_BASE_ARGS, "status", "--porcelain=v1", "-z"],
        { cwd, timeout, env: safeEnv() },
      ));
    } catch (error) {
      log("warn", "git_status_hash_failed", { error: getErrorMessage(error) });
      return { kind: "unavailable" };
    }

    const externalStatusFiles = parseHashableStatusFiles(stdout);
    const externalFiles = externalStatusFiles
      .map(({ entry }) =>
        [entry.indexStatus, entry.workTreeStatus, entry.path, entry.previousPath ?? ""].join("\0"),
      )
      .sort();
    if (externalFiles.length === 0) {
      return { kind: "full", hash: "" };
    }

    const hash = createHash("sha256");
    hash.update(externalFiles.join("\0"));
    const externalPaths = [...new Set(externalStatusFiles.map(({ entry }) => entry.path))];

    // Include diff contents so the hash changes when file content changes even
    // if the status lines remain the same. A diff failure (e.g. a >maxBuffer
    // worktree diff) degrades the hash to status-lines-only; the discriminant
    // records that so a content-blind hash is never compared as content-full.
    try {
      const [{ stdout: unstagedDiff }, { stdout: stagedDiff }] = await Promise.all([
        execFileAsync(
          "git",
          [
            ...HARDENED_BASE_ARGS,
            "diff",
            "--no-ext-diff",
            "--no-textconv",
            "--no-color",
            "--",
            ...externalPaths,
          ],
          {
            cwd,
            timeout,
            maxBuffer: GIT_DIFF_MAX_BUFFER,
            env: safeEnv(),
          },
        ),
        execFileAsync(
          "git",
          [
            ...HARDENED_BASE_ARGS,
            "diff",
            "--cached",
            "--no-ext-diff",
            "--no-textconv",
            "--no-color",
            "--",
            ...externalPaths,
          ],
          { cwd, timeout, maxBuffer: GIT_DIFF_MAX_BUFFER, env: safeEnv() },
        ),
      ]);
      if (unstagedDiff) hash.update(unstagedDiff);
      if (stagedDiff) hash.update(stagedDiff);
    } catch {
      return { kind: "status-only", hash: hash.digest("hex").slice(0, 16) };
    }

    return { kind: "full", hash: hash.digest("hex").slice(0, 16) };
  }

  return {
    getStatus,
    getDiff,
    isGitInstalled,
    getHeadCommit,
    getStatusHash,
  };
}
