import { useQuery } from "@tanstack/react-query";
import { useApi } from "./context.js";
import { gitQueries } from "./queries/git.js";

export function useGitStatus() {
  const api = useApi();
  return useQuery(gitQueries.status(api));
}
