import type { GitFileEntry } from "@stargazer/schemas/git";

export type GitDiffErrorCode =
  | "GIT_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "TIMEOUT"
  | "BUFFER_EXCEEDED"
  | "NOT_A_REPOSITORY"
  | "UNKNOWN";

export interface ClassifiedError {
  code: GitDiffErrorCode;
  message: string;
}

export interface BranchInfo {
  branch: string | null;
  remoteBranch: string | null;
  ahead: number;
  behind: number;
}

export interface CategorizedFile {
  entry: GitFileEntry;
  isConflicted: boolean;
  isUntracked: boolean;
  isStaged: boolean;
  isUnstaged: boolean;
}
