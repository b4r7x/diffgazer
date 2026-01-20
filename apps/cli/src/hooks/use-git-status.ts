import type { GitStatus } from "@repo/schemas/git";
import { GitStatusResponseSchema } from "@repo/schemas/git";
import { useGitQuery, type GitQueryState } from "./use-git-query.js";

export type GitStatusState = GitQueryState<GitStatus>;

export function useGitStatus(baseUrl: string) {
  return useGitQuery<GitStatus>(baseUrl, {
    endpoint: "/git/status",
    schema: GitStatusResponseSchema,
  });
}
