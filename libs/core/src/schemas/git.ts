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

export interface GitStatus {
  isGitRepo: boolean;
  branch: string | null;
  remoteBranch: string | null;
  ahead: number;
  behind: number;
  files: GitStatusFiles;
  hasChanges: boolean;
  conflicted: string[];
}
