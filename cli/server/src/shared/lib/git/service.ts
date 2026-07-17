import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { promisify } from "node:util";
import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  GIT_FILE_STATUS_CODES,
  type GitFileEntry,
  type GitFileStatusCode,
  type GitStatus,
  type GitStatusFiles,
} from "@diffgazer/core/schemas/git";
import type { ReviewMode } from "@diffgazer/core/schemas/review";
import { log } from "../log.js";
import type { BranchInfo, CategorizedFile } from "./types.js";

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

function emptyBranchInfo(): BranchInfo {
  return { branch: null, remoteBranch: null, ahead: 0, behind: 0 };
}

function parseV1BranchLine(line: string): BranchInfo {
  const result = emptyBranchInfo();

  if (!line.includes("...")) {
    result.branch = line || null;
    return result;
  }

  const [local, rest] = line.split("...");
  result.branch = local || null;

  if (!rest) return result;

  const remoteMatch = rest.match(/^(\S+)/);
  result.remoteBranch = remoteMatch?.[1] ?? null;
  result.ahead = Number(rest.match(/ahead (\d+)/)?.[1] ?? 0);
  result.behind = Number(rest.match(/behind (\d+)/)?.[1] ?? 0);

  return result;
}

const STATUS_CODES: Set<string> = new Set(GIT_FILE_STATUS_CODES);
const UNMERGED_STATUS_PAIRS = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);
const INTERNAL_DIFFGAZER_DIR = ".diffgazer";

function toStatusCode(char: string): GitFileStatusCode {
  return STATUS_CODES.has(char) ? (char as GitFileStatusCode) : " ";
}

function categorizeGitFile(
  status: string,
  path: string,
  previousPath?: string,
): CategorizedFile | null {
  if (status.length !== 2 || path.length === 0) return null;

  const indexStatus = toStatusCode(status[0] ?? " ");
  const workTreeStatus = toStatusCode(status[1] ?? " ");
  const entry: GitFileEntry =
    previousPath === undefined
      ? { path, indexStatus, workTreeStatus }
      : {
          path,
          previousPath,
          indexStatus,
          workTreeStatus,
        };

  return {
    entry,
    isConflicted: UNMERGED_STATUS_PAIRS.has(`${indexStatus}${workTreeStatus}`),
    isUntracked: indexStatus === "?" && workTreeStatus === "?",
    isStaged: indexStatus !== " " && indexStatus !== "?",
    isUnstaged: workTreeStatus !== " " && workTreeStatus !== "?",
  };
}

function parseV1GitStatusRecords(output: string): {
  branch: BranchInfo;
  files: CategorizedFile[];
} {
  let branch = emptyBranchInfo();
  const files: CategorizedFile[] = [];
  const records = output.split("\0");

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;

    if (record.startsWith("## ")) {
      branch = parseV1BranchLine(record.slice(3));
      continue;
    }

    const indexStatus = record[0] ?? " ";
    const workTreeStatus = record[1] ?? " ";
    const hasPreviousPath =
      indexStatus === "R" ||
      indexStatus === "C" ||
      workTreeStatus === "R" ||
      workTreeStatus === "C";
    const previousPath = hasPreviousPath ? records[index + 1] : undefined;
    if (hasPreviousPath) index += 1;

    const categorized = categorizeGitFile(record.slice(0, 2), record.slice(3), previousPath);
    if (categorized) files.push(categorized);
  }

  return { branch, files };
}

function pathAfterFields(record: string, fieldCount: number): string | null {
  let separator = -1;
  for (let field = 0; field < fieldCount; field += 1) {
    separator = record.indexOf(" ", separator + 1);
    if (separator === -1) return null;
  }
  return record.slice(separator + 1);
}

function parseBranchRecord(record: string, branch: BranchInfo): void {
  if (record.startsWith("# branch.head ")) {
    const head = record.slice("# branch.head ".length);
    branch.branch = head === "(detached)" ? null : head || null;
    return;
  }
  if (record.startsWith("# branch.upstream ")) {
    branch.remoteBranch = record.slice("# branch.upstream ".length) || null;
    return;
  }
  if (record.startsWith("# branch.ab ")) {
    const counts = /^\+(\d+) -(\d+)$/.exec(record.slice("# branch.ab ".length));
    branch.ahead = Number(counts?.[1] ?? 0);
    branch.behind = Number(counts?.[2] ?? 0);
  }
}

function parseV2GitStatusRecords(output: string): {
  branch: BranchInfo;
  files: CategorizedFile[];
} {
  const branch = emptyBranchInfo();
  const files: CategorizedFile[] = [];
  const records = output.split("\0");

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;
    if (record.startsWith("# ")) {
      parseBranchRecord(record, branch);
      continue;
    }

    let status: string;
    let path: string | null;
    let previousPath: string | undefined;
    if (record.startsWith("1 ")) {
      status = record.slice(2, 4);
      path = pathAfterFields(record, 8);
    } else if (record.startsWith("2 ")) {
      status = record.slice(2, 4);
      path = pathAfterFields(record, 9);
      previousPath = records[index + 1];
      index += 1;
    } else if (record.startsWith("u ")) {
      status = record.slice(2, 4);
      path = pathAfterFields(record, 10);
    } else if (record.startsWith("? ")) {
      status = "??";
      path = record.slice(2);
    } else {
      continue;
    }

    if (path === null) continue;
    const categorized = categorizeGitFile(status, path, previousPath);
    if (categorized) files.push(categorized);
  }

  return { branch, files };
}

function parseGitStatusOutput(output: string): {
  branch: string | null;
  remoteBranch: string | null;
  ahead: number;
  behind: number;
  files: GitStatusFiles;
  conflicted: string[];
} {
  const parsed = output.includes("# branch.")
    ? parseV2GitStatusRecords(output)
    : parseV1GitStatusRecords(output);
  const staged: GitFileEntry[] = [];
  const unstaged: GitFileEntry[] = [];
  const untracked: GitFileEntry[] = [];
  const conflicted: string[] = [];

  for (const categorized of parsed.files) {
    const { entry, isConflicted, isUntracked, isStaged, isUnstaged } = categorized;

    if (isConflicted) conflicted.push(entry.path);
    if (isUntracked) untracked.push(entry);
    else if (isStaged) staged.push(entry);
    if (isUnstaged) unstaged.push(entry);
  }

  return {
    ...parsed.branch,
    files: { staged, unstaged, untracked },
    conflicted,
  };
}

function isInternalDiffgazerPath(path: string): boolean {
  return path === INTERNAL_DIFFGAZER_DIR || path.startsWith(`${INTERNAL_DIFFGAZER_DIR}/`);
}

function isExternalStatusFile(file: CategorizedFile): boolean {
  return !isInternalDiffgazerPath(file.entry.path);
}

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
      const isExternal = (entry: GitFileEntry) => !isInternalDiffgazerPath(entry.path);
      parsed.files.staged = parsed.files.staged.filter(isExternal);
      parsed.files.unstaged = parsed.files.unstaged.filter(isExternal);
      parsed.files.untracked = parsed.files.untracked.filter(isExternal);
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

    const externalStatusFiles = parseV1GitStatusRecords(stdout).files.filter(
      (file) => isExternalStatusFile(file) && !file.isUntracked,
    );
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
