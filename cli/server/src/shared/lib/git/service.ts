import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { lstat, readFile, realpath } from "node:fs/promises";
import { join, resolve, sep } from "node:path";
import { promisify } from "node:util";
import { GIT_FILE_STATUS_CODES, type GitStatus, type GitStatusFiles, type GitFileEntry, type GitFileStatusCode } from "@diffgazer/core/schemas/git";
import type { GitBlameInfo, ReviewMode } from "@diffgazer/core/schemas/review";
import { type Result, ok, err } from "@diffgazer/core/result";
import { getErrorMessage } from "@diffgazer/core/errors";
import type { BranchInfo, CategorizedFile } from "./types.js";

const execFileAsync = promisify(execFile);

const GIT_DIFF_MAX_BUFFER = 5 * 1024 * 1024;

const SANITIZED_GIT_ENV: Record<string, string> = {
  GIT_EXTERNAL_DIFF: "",
  GIT_PAGER: "",
  GIT_DIFF_OPTS: "",
  GIT_DIR: "",
  GIT_WORK_TREE: "",
  GIT_INDEX_FILE: "",
  GIT_CONFIG: "",
  GIT_CONFIG_GLOBAL: "",
  GIT_CONFIG_SYSTEM: "",
  GIT_CONFIG_COUNT: "",
  GIT_CONFIG_PARAMETERS: "",
  GIT_ALTERNATE_OBJECT_DIRECTORIES: "",
  GIT_OBJECT_DIRECTORY: "",
  GIT_CEILING_DIRECTORIES: "",
  GIT_EXEC_PATH: "",
  GIT_SSH_COMMAND: "",
  GIT_ASKPASS: "",
  GIT_PROXY_COMMAND: "",
  GIT_HOOKS_PATH: "",
  GIT_TEMPLATE_DIR: "",
};

const EMPTY_GIT_STATUS: GitStatus = {
  isGitRepo: false,
  branch: null,
  remoteBranch: null,
  ahead: 0,
  behind: 0,
  files: { staged: [], unstaged: [], untracked: [] },
  hasChanges: false,
  conflicted: [],
};

function parseBranchLine(line: string): BranchInfo {
  const result: BranchInfo = { branch: null, remoteBranch: null, ahead: 0, behind: 0 };

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
const INTERNAL_DIFFGAZER_DIR = ".diffgazer";

function toStatusCode(char: string): GitFileStatusCode {
  return STATUS_CODES.has(char) ? (char as GitFileStatusCode) : " ";
}

function categorizeGitFile(line: string): CategorizedFile | null {
  if (line.length < 3) return null;

  const indexStatus = toStatusCode(line[0] ?? " ");
  const workTreeStatus = toStatusCode(line[1] ?? " ");
  const path = line.slice(3);

  const entry: GitFileEntry = { path, indexStatus, workTreeStatus };

  return {
    entry,
    isConflicted: indexStatus === "U" || workTreeStatus === "U",
    isUntracked: indexStatus === "?" && workTreeStatus === "?",
    isStaged: indexStatus !== " " && indexStatus !== "?",
    isUnstaged: workTreeStatus !== " " && workTreeStatus !== "?",
  };
}

function parseGitStatusOutput(output: string): {
  branch: string | null;
  remoteBranch: string | null;
  ahead: number;
  behind: number;
  files: GitStatusFiles;
  conflicted: string[];
} {
  const lines = output.split("\n").filter((line) => line.length > 0);
  let branch: string | null = null;
  let remoteBranch: string | null = null;
  let ahead = 0, behind = 0;
  const staged: GitFileEntry[] = [];
  const unstaged: GitFileEntry[] = [];
  const untracked: GitFileEntry[] = [];
  const conflicted: string[] = [];

  for (const line of lines) {
    if (line.startsWith("## ")) {
      const parsed = parseBranchLine(line.slice(3));
      branch = parsed.branch;
      remoteBranch = parsed.remoteBranch;
      ahead = parsed.ahead;
      behind = parsed.behind;
      continue;
    }

    const categorized = categorizeGitFile(line);
    if (!categorized) continue;

    const { entry, isConflicted, isUntracked, isStaged, isUnstaged } = categorized;

    if (isConflicted) conflicted.push(entry.path);
    if (isUntracked) untracked.push(entry);
    else if (isStaged) staged.push(entry);
    if (isUnstaged) unstaged.push(entry);
  }

  return { branch, remoteBranch, ahead, behind, files: { staged, unstaged, untracked }, conflicted };
}

function isInternalDiffgazerPath(pathPart: string): boolean {
  const normalized = pathPart.trim();
  return normalized === INTERNAL_DIFFGAZER_DIR || normalized.startsWith(`${INTERNAL_DIFFGAZER_DIR}/`);
}

function isUntrackedLine(line: string): boolean {
  return line.length >= 2 && line[0] === "?" && line[1] === "?";
}

function isExternalStatusLine(line: string): boolean {
  if (line.length < 3) return false;
  const pathPart = line.slice(3).trim();
  if (!pathPart) return false;

  const paths = pathPart.split(" -> ").map((part) => part.trim()).filter(Boolean);
  return paths.every((path) => !isInternalDiffgazerPath(path));
}

export function createGitService(options: { cwd?: string; timeout?: number } = {}) {
  const { cwd = process.cwd(), timeout = 10000 } = options;

  function safeEnv(): Record<string, string | undefined> {
    return { ...process.env, ...SANITIZED_GIT_ENV };
  }

  async function isGitInstalled(): Promise<boolean> {
    try {
      await execFileAsync("git", ["--version"], { timeout });
      return true;
    } catch (error) {
      console.warn("[git] failed to check git installation:", getErrorMessage(error));
      return false;
    }
  }

  async function getStatus(): Promise<Result<GitStatus, { message: string }>> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain=v1", "-b"],
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
      console.warn("[git] failed to get status:", msg);
      return err({ message: msg });
    }
  }

  async function getDiff(mode: ReviewMode = "unstaged", pathspecs?: string[]): Promise<string> {
    const args = mode === "staged"
      ? ["diff", "--cached", "--no-ext-diff", "--no-textconv", "--no-color"]
      : ["diff", "--no-ext-diff", "--no-textconv", "--no-color"];
    if (pathspecs && pathspecs.length > 0) {
      args.push("--", ...pathspecs);
    }
    const { stdout } = await execFileAsync("git", args, { cwd, timeout, maxBuffer: GIT_DIFF_MAX_BUFFER, env: safeEnv() });
    return stdout;
  }

  async function getBlame(file: string, line: number): Promise<GitBlameInfo | null> {
    try {
      const args = ["blame", "-L", `${line},${line}`, "--porcelain", "--", file];
      const { stdout } = await execFileAsync("git", args, { cwd, timeout, env: safeEnv() });

      const lines = stdout.split("\n");
      const commit = lines[0]?.split(" ")[0] ?? "";
      const author = lines.find(l => l.startsWith("author "))?.slice(7) ?? "Unknown";
      const authorEmail = lines.find(l => l.startsWith("author-mail "))?.slice(12).replace(/[<>]/g, "") ?? "";
      const commitTime = lines.find(l => l.startsWith("author-time "))?.slice(12) ?? "0";
      const summary = lines.find(l => l.startsWith("summary "))?.slice(8) ?? "";

      return {
        author,
        authorEmail,
        commit,
        commitDate: new Date(Number(commitTime) * 1000).toISOString(),
        summary,
      };
    } catch (error) {
      console.warn(`[git] failed to get blame for ${file}:${line}:`, getErrorMessage(error));
      return null;
    }
  }

  async function getFileLines(file: string, startLine: number, endLine: number, source: "HEAD" | "worktree" = "worktree"): Promise<string[]> {
    try {
      if (source === "worktree") {
        const resolved = resolve(cwd, file);
        const realCwd = await realpath(cwd);
        const realResolved = await realpath(resolved).catch(() => resolved);
        if (realResolved !== realCwd && !realResolved.startsWith(realCwd + sep)) {
          return [];
        }
        const stat = await lstat(realResolved);
        if (!stat.isFile()) {
          return [];
        }
        const content = await readFile(realResolved, "utf-8");
        const allLines = content.split("\n");
        return allLines.slice(Math.max(0, startLine - 1), endLine);
      }
      // Note: git show object syntax (HEAD:path) doesn't accept a -- separator;
      // option injection is structurally impossible since the arg starts with "HEAD:".
      const args = ["show", `HEAD:${file}`];
      const { stdout } = await execFileAsync("git", args, { cwd, timeout, maxBuffer: GIT_DIFF_MAX_BUFFER, env: safeEnv() });
      const allLines = stdout.split("\n");
      return allLines.slice(Math.max(0, startLine - 1), endLine);
    } catch (error) {
      console.warn(`[git] failed to get file lines for ${file}:`, getErrorMessage(error));
      return [];
    }
  }

  async function getHeadCommit(): Promise<Result<string, { message: string }>> {
    try {
      const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd, timeout, env: safeEnv() });
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

  async function getStatusHash(): Promise<string | null> {
    try {
      const { stdout } = await execFileAsync(
        "git",
        ["--no-optional-locks", "-c", "core.fsmonitor=false", "status", "--porcelain"],
        { cwd, timeout, env: safeEnv() },
      );
      const externalLines = stdout
        .split("\n")
        .filter((line) => line.length > 0 && isExternalStatusLine(line) && !isUntrackedLine(line))
        .sort();
      if (externalLines.length === 0) {
        return "";
      }

      const hash = createHash("sha256");
      hash.update(externalLines.join("\n"));

      // Include diff contents so the hash changes when file content changes
      // even if the status lines remain the same.
      try {
        const [{ stdout: unstagedDiff }, { stdout: stagedDiff }] = await Promise.all([
          execFileAsync("git", ["diff", "--no-ext-diff", "--no-textconv", "--no-color"], { cwd, timeout, maxBuffer: GIT_DIFF_MAX_BUFFER, env: safeEnv() }),
          execFileAsync("git", ["diff", "--cached", "--no-ext-diff", "--no-textconv", "--no-color"], { cwd, timeout, maxBuffer: GIT_DIFF_MAX_BUFFER, env: safeEnv() }),
        ]);
        if (unstagedDiff) hash.update(unstagedDiff);
        if (stagedDiff) hash.update(stagedDiff);
      } catch {
        // Diff read failure is non-fatal; status lines alone still provide a hash.
      }

      return hash.digest("hex").slice(0, 16);
    } catch (error) {
      console.warn("[git] failed to get status hash:", getErrorMessage(error));
      return null;
    }
  }

  return { getStatus, getDiff, isGitInstalled, getBlame, getFileLines, getHeadCommit, getStatusHash };
}
