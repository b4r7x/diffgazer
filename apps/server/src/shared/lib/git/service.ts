import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { GIT_FILE_STATUS_CODES, type GitStatus, type GitStatusFiles, type GitFileEntry, type GitFileStatusCode } from "@stargazer/schemas/git";
import type { GitBlameInfo, ReviewMode } from "@stargazer/schemas/review";
import { type Result, ok, err } from "@stargazer/core/result";
import { getErrorMessage } from "@stargazer/core/errors";
import type { BranchInfo, CategorizedFile } from "./types.js";

const execFileAsync = promisify(execFile);

const GIT_DIFF_MAX_BUFFER = 5 * 1024 * 1024;

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

export function createGitService(options: { cwd?: string; timeout?: number } = {}) {
  const { cwd = process.cwd(), timeout = 10000 } = options;

  async function isGitInstalled(): Promise<boolean> {
    try {
      await execFileAsync("git", ["--version"], { timeout });
      return true;
    } catch (error) {
      console.warn("[git] failed to check git installation:", getErrorMessage(error));
      return false;
    }
  }

  async function getStatus(): Promise<GitStatus> {
    try {
      const { stdout } = await execFileAsync("git", ["status", "--porcelain=v1", "-b"], { cwd, timeout });
      const parsed = parseGitStatusOutput(stdout);
      const hasChanges = parsed.files.staged.length > 0 || parsed.files.unstaged.length > 0 || parsed.files.untracked.length > 0;
      return { isGitRepo: true, ...parsed, hasChanges };
    } catch (error) {
      console.warn("[git] failed to get status:", getErrorMessage(error));
      return EMPTY_GIT_STATUS;
    }
  }

  async function getDiff(mode: ReviewMode = "unstaged"): Promise<string> {
    const args = mode === "staged" ? ["diff", "--cached"] : ["diff"];
    // "files" mode falls through to unstaged diff intentionally —
    // file filtering is applied after diff retrieval by the caller.
    const { stdout } = await execFileAsync("git", args, { cwd, timeout, maxBuffer: GIT_DIFF_MAX_BUFFER });
    return stdout;
  }

  async function getBlame(file: string, line: number): Promise<GitBlameInfo | null> {
    try {
      const args = ["blame", "-L", `${line},${line}`, "--porcelain", file];
      const { stdout } = await execFileAsync("git", args, { cwd, timeout });

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

  async function getFileLines(file: string, startLine: number, endLine: number): Promise<string[]> {
    try {
      const args = ["show", `HEAD:${file}`];
      const { stdout } = await execFileAsync("git", args, { cwd, timeout, maxBuffer: GIT_DIFF_MAX_BUFFER });
      const allLines = stdout.split("\n");
      return allLines.slice(Math.max(0, startLine - 1), endLine);
    } catch (error) {
      console.warn(`[git] failed to get file lines for ${file}:`, getErrorMessage(error));
      return [];
    }
  }

  async function getHeadCommit(): Promise<Result<string, { message: string }>> {
    try {
      const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd, timeout });
      const commit = stdout.trim();
      if (!commit) {
        return err({ message: "Empty commit hash returned from git rev-parse HEAD" });
      }
      return ok(commit);
    } catch (error) {
      return err({ message: getErrorMessage(error, "Failed to get HEAD commit") });
    }
  }

  async function getStatusHash(): Promise<string> {
    try {
      const { stdout } = await execFileAsync("git", ["status", "--porcelain"], { cwd, timeout });
      const lines = stdout.split("\n").filter(Boolean).sort();
      if (lines.length === 0) {
        return "";
      }
      const { createHash } = await import("node:crypto");
      return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
    } catch (error) {
      console.warn("[git] failed to get status hash:", getErrorMessage(error));
      return "";
    }
  }

  return { getStatus, getDiff, isGitInstalled, getBlame, getFileLines, getHeadCommit, getStatusHash };
}
