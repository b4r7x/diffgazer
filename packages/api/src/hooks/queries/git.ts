import { queryOptions } from "@tanstack/react-query";
import type { ReviewMode } from "@diffgazer/schemas/review";
import type { BoundApi } from "../../bound.js";

export const gitQueries = {
  all: () => ["git"] as const,

  status: (api: BoundApi, path?: string) =>
    queryOptions({
      queryKey: [...gitQueries.all(), "status", path] as const,
      queryFn: () => api.getGitStatus({ path }),
      staleTime: 0,
    }),

  diff: (api: BoundApi, mode?: ReviewMode, path?: string) =>
    queryOptions({
      queryKey: [...gitQueries.all(), "diff", mode, path] as const,
      queryFn: () => api.getGitDiff({ mode, path }),
      staleTime: 0,
    }),
};
