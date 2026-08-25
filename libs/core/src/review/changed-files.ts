import type { GitFileEntry, GitFileStatusCode, GitStatus } from "../schemas/git.js";
import type { ReviewMode } from "../schemas/review/index.js";

/**
 * One row of a review file picker: a path the selected mode's diff will actually
 * carry, labelled with what happened to it.
 */
export interface ReviewableFile {
  /** Repo-relative, exactly as `files[]` must be sent back to the server. */
  path: string;
  /** Porcelain code for the change this mode sees: `M`, `A`, `D`, `R`, and so on. */
  status: GitFileStatusCode;
  /** Set for a rename; the name the file had before. */
  previousPath?: string;
  /** Unresolved merge conflicts. The review excludes these files, so a picker must not offer them. */
  conflicted: boolean;
}

const STATUS_LABELS: Partial<Record<GitFileStatusCode, string>> = {
  M: "modified",
  T: "type changed",
  A: "added",
  D: "deleted",
  R: "renamed",
  C: "copied",
  U: "conflicted",
};

export function describeFileStatus(status: GitFileStatusCode): string {
  return STATUS_LABELS[status] ?? "changed";
}

/** Why a conflicted row is on screen but cannot be picked, in every picker's words. */
export const CONFLICTED_FILE_NOTE = "Resolve the conflict first — reviews skip conflicted files.";

function toReviewableFile(
  entry: GitFileEntry,
  mode: "staged" | "unstaged",
  conflicted: Set<string>,
): ReviewableFile {
  return {
    path: entry.path,
    status: mode === "staged" ? entry.indexStatus : entry.workTreeStatus,
    ...(entry.previousPath ? { previousPath: entry.previousPath } : {}),
    conflicted: conflicted.has(entry.path),
  };
}

/**
 * The files a review of `mode` would read, in path order.
 *
 * It mirrors what the server actually runs: `staged` is `git diff --cached`, so
 * it sees the index bucket; `unstaged` is a plain `git diff`, so it sees the
 * worktree bucket. Untracked files appear in neither — `git diff` does not
 * report a file git has never seen — so they are absent here too rather than
 * offered as a choice that would silently review nothing.
 */
export function reviewableFilesForMode(
  status: GitStatus,
  mode: Exclude<ReviewMode, "files">,
): ReviewableFile[] {
  const conflicted = new Set(status.conflicted);
  const entries = mode === "staged" ? status.files.staged : status.files.unstaged;
  return entries
    .map((entry) => toReviewableFile(entry, mode, conflicted))
    .sort((a, b) => a.path.localeCompare(b.path));
}
