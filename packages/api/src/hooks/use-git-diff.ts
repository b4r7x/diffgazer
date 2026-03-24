import { useQuery } from "@tanstack/react-query";
import type { ReviewMode } from "@diffgazer/schemas/review";
import { gitQueries } from "./queries/git.queries.js";
import { useApi } from "./context.js";

export function useGitDiff(mode?: ReviewMode, path?: string) {
  const api = useApi();
  return useQuery(gitQueries.diff(api, mode, path));
}
