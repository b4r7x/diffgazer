import type { GitError } from "@repo/schemas/git";

export function makeError(message: string): GitError {
  return { message, code: "UNKNOWN" };
}
