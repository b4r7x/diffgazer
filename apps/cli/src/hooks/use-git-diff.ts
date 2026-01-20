import type { GitDiff } from "@repo/schemas/git";
import { GitDiffResponseSchema } from "@repo/schemas/git";
import { useGitQuery, type GitQueryState } from "./use-git-query.js";

export type GitDiffState = GitQueryState<GitDiff>;

export function useGitDiff(baseUrl: string) {
  const { state, fetch: baseFetch, reset } = useGitQuery<GitDiff>(baseUrl, {
    endpoint: "/git/diff",
    schema: GitDiffResponseSchema,
  });

  function fetch(staged = false) {
    return baseFetch(staged ? { staged: "true" } : undefined);
  }

  return { state, fetch, reset };
}
