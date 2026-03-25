import { queryOptions } from "@tanstack/react-query";
import type { BoundApi } from "../../bound.js";

export const trustQueries = {
  all: () => ["trust"] as const,

  single: (api: BoundApi, projectId: string) =>
    queryOptions({
      queryKey: [...trustQueries.all(), projectId] as const,
      queryFn: () => api.getTrust(projectId),
      staleTime: 60_000,
    }),

  list: (api: BoundApi) =>
    queryOptions({
      queryKey: [...trustQueries.all(), "list"] as const,
      queryFn: () => api.listTrustedProjects(),
      staleTime: 60_000,
    }),
};
