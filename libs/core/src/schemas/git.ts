export const GIT_FILE_STATUS_CODES = ["M", "T", "A", "D", "R", "C", "U", "?", "!", " "] as const;
export type GitFileStatusCode = (typeof GIT_FILE_STATUS_CODES)[number];

export interface GitFileEntry {
  path: string;
  previousPath?: string;
  indexStatus: GitFileStatusCode;
  workTreeStatus: GitFileStatusCode;
}

export interface GitStatusFiles {
  staged: GitFileEntry[];
  unstaged: GitFileEntry[];
  untracked: GitFileEntry[];
}

/**
 * Recorded as the branch when HEAD is detached. Porcelain reports `(detached)`, which is
 * itself a legal branch name, so the sentinel carries a space instead: `git check-ref-format`
 * rejects spaces in ref names, which keeps it out of the branch-name value domain.
 */
export const DETACHED_HEAD_BRANCH = "HEAD (detached)";

export interface GitStatus {
  isGitRepo: boolean;
  /** Current branch, `DETACHED_HEAD_BRANCH` when HEAD is detached, `null` when unknown. */
  branch: string | null;
  remoteBranch: string | null;
  ahead: number;
  behind: number;
  files: GitStatusFiles;
  hasChanges: boolean;
  conflicted: string[];
}
