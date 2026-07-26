import { getErrorMessage } from "@diffgazer/core/errors";
import { classifyError, type ErrorRule } from "../errors.js";
import type { GitDiffErrorCode } from "./types.js";

const GIT_ERROR_RULES: ErrorRule<GitDiffErrorCode>[] = [
  {
    patterns: [
      "enoent",
      "spawn git",
      "git command not found",
      "git: command not found",
      "command not found: git",
    ],
    code: "GIT_NOT_FOUND",
    message: "Git is not installed or not in PATH. Please install git and try again.",
  },
  {
    patterns: ["eacces", "permission denied"],
    code: "PERMISSION_DENIED",
    message: "Permission denied when accessing git. Check file permissions.",
  },
  {
    patterns: ["etimedout", "timed out", "timeout"],
    code: "TIMEOUT",
    message:
      "Git operation timed out. The repository may be too large or the system is under heavy load.",
  },
  {
    patterns: ["maxbuffer", "stdout maxbuffer"],
    code: "BUFFER_EXCEEDED",
    message: "Git diff output exceeded buffer limit. The changes may be too large to process.",
  },
  {
    patterns: ["not a git repository"],
    code: "NOT_A_REPOSITORY",
    message: "Not a git repository. Please run this command from within a git repository.",
  },
];

export interface GitDiffError {
  code: GitDiffErrorCode;
  message: string;
}

export function createGitDiffError(error: unknown): GitDiffError {
  const originalMessage = getErrorMessage(error);
  const classified = classifyError(error, GIT_ERROR_RULES, {
    code: "UNKNOWN",
    message: (msg) => `Failed to get git diff: ${msg}`,
  });

  if (classified.code === "UNKNOWN") {
    return classified;
  }
  return { code: classified.code, message: `${classified.message} (Original: ${originalMessage})` };
}
