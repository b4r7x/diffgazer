import {
  DETACHED_HEAD_BRANCH,
  GIT_FILE_STATUS_CODES,
  type GitFileEntry,
  type GitFileStatusCode,
  type GitStatusFiles,
} from "@diffgazer/core/schemas/git";
import type { BranchInfo, CategorizedFile } from "./types.js";

const STATUS_CODES: Set<string> = new Set(GIT_FILE_STATUS_CODES);
const UNMERGED_STATUS_PAIRS = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);
const INTERNAL_DIFFGAZER_DIR = ".diffgazer";

function emptyBranchInfo(): BranchInfo {
  return { branch: null, remoteBranch: null, ahead: 0, behind: 0 };
}

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

/**
 * Porcelain v1 file records. `getStatusHash` is the only producer and it runs
 * `--porcelain=v1 -z` without `--branch`, so no `## ` header record is emitted
 * and this parser owns no branch handling.
 */
function parseV1StatusFiles(output: string): CategorizedFile[] {
  const files: CategorizedFile[] = [];
  const records = output.split("\0");

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!record) continue;

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

  return files;
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
    branch.branch = head === "(detached)" ? DETACHED_HEAD_BRANCH : head || null;
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

function isInternalDiffgazerPath(path: string): boolean {
  return path === INTERNAL_DIFFGAZER_DIR || path.startsWith(`${INTERNAL_DIFFGAZER_DIR}/`);
}

function isExternalStatusFile(file: CategorizedFile): boolean {
  return !isInternalDiffgazerPath(file.entry.path);
}

/** Parses the `--porcelain=v2 --branch -z` output `getStatus` always requests. */
export function parseGitStatusOutput(output: string): {
  branch: string | null;
  remoteBranch: string | null;
  ahead: number;
  behind: number;
  files: GitStatusFiles;
  conflicted: string[];
} {
  const parsed = parseV2GitStatusRecords(output);
  const staged: GitFileEntry[] = [];
  const unstaged: GitFileEntry[] = [];
  const untracked: GitFileEntry[] = [];
  const conflicted: string[] = [];

  for (const categorized of parsed.files) {
    if (!isExternalStatusFile(categorized)) continue;

    const { entry, isConflicted, isUntracked, isStaged, isUnstaged } = categorized;

    if (isConflicted) conflicted.push(entry.path);
    if (isUntracked) untracked.push(entry);
    else if (isStaged) staged.push(entry);
    if (isUnstaged) unstaged.push(entry);
  }

  return {
    ...parsed.branch,
    files: {
      staged,
      unstaged,
      untracked,
    },
    conflicted,
  };
}

export function parseHashableStatusFiles(output: string): CategorizedFile[] {
  return parseV1StatusFiles(output).filter(
    (file) => isExternalStatusFile(file) && !file.isUntracked,
  );
}
