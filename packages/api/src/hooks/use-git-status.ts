import { useQuery } from "@tanstack/react-query";
import { gitQueries } from "./queries/git.queries.js";
import { useApi } from "./context.js";

export function useGitStatus(path?: string) {
  const api = useApi();
  return useQuery(gitQueries.status(api, path));
}
