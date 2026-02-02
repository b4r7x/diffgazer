import type { GitStatus } from "@repo/schemas/git";
import { GitStatusSchema } from "@repo/schemas/git";
import { useGitQuery, type GitQueryState } from "./use-git-query.js";

export type GitStatusState = GitQueryState<GitStatus>;

export function useGitStatus() {
  return useGitQuery<GitStatus>({
    endpoint: "/git/status",
    schema: GitStatusSchema,
  });
}
