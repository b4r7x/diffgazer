import { useQuery } from "@tanstack/react-query";
import { useApi } from "./context.js";
import { gitQueries } from "./queries/git.js";

/** Reads the working tree's staged/unstaged/untracked entries. */
export function useGitStatus(options?: { enabled?: boolean }) {
  const api = useApi();
  return useQuery({ ...gitQueries.status(api), ...options });
}
