import { queryOptions } from "@tanstack/react-query";
import type { BoundApi } from "../../bound.js";

export const gitQueries = {
  all: () => ["git"] as const,

  // The working tree changes under the user while a picker is open, so the
  // status is never treated as fresh: whoever mounts a file list gets the tree
  // as it is now, not as it was when some other screen last asked.
  status: (api: BoundApi) =>
    queryOptions({
      queryKey: [...gitQueries.all(), "status"] as const,
      queryFn: ({ signal }) => api.getGitStatus(signal),
      staleTime: 0,
    }),
};
