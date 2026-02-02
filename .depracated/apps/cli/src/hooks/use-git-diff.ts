import type { GitDiff } from "@repo/schemas/git";
import { GitDiffSchema } from "@repo/schemas/git";
import { useGitQuery, type GitQueryState } from "./use-git-query.js";

export type GitDiffState = GitQueryState<GitDiff>;

export function useGitDiff() {
  const { state, fetch: baseFetch, reset } = useGitQuery<GitDiff>({
    endpoint: "/git/diff",
    schema: GitDiffSchema,
  });

  function fetch(staged = false) {
    return baseFetch(staged ? { staged: "true" } : undefined);
  }

  return { state, fetch, reset };
}
