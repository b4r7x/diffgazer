import { getErrorMessage } from "@stargazer/core";
import type { GitDiffErrorCode, ClassifiedError } from "./types.js";

export type { GitDiffErrorCode } from "./types.js";

const rules: Array<{ patterns: string[]; code: GitDiffErrorCode; message: string }> = [
  {
    patterns: ["enoent", "spawn git", "not found"],
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
    message: "Git operation timed out. The repository may be too large or the system is under heavy load.",
  },
  {
    patterns: ["maxbuffer", "stdout maxbuffer"],
    code: "BUFFER_EXCEEDED",
    message: "Git diff output exceeded buffer limit. The changes may be too large to process.",
  },
  {
    patterns: ["not a git repository", "fatal:"],
    code: "NOT_A_REPOSITORY",
    message: "Not a git repository. Please run this command from within a git repository.",
  },
];

function classifyGitDiffError(error: unknown): ClassifiedError {
  const msg = getErrorMessage(error).toLowerCase();
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => msg.includes(pattern))) {
      return { code: rule.code, message: rule.message };
    }
  }
  return { code: "UNKNOWN", message: `Failed to get git diff: ${getErrorMessage(error)}` };
}

export function createGitDiffError(error: unknown): Error {
  const originalMessage = getErrorMessage(error);
  const classified = classifyGitDiffError(error);

  if (classified.code === "UNKNOWN") {
    return new Error(classified.message);
  }
  return new Error(`${classified.message} (Original: ${originalMessage})`);
}
