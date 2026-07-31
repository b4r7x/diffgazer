import { queryOptions } from "@tanstack/react-query";
import type { BoundApi } from "../../bound.js";

export const configQueries = {
  all: () => ["config"] as const,

  settings: (api: BoundApi) =>
    queryOptions({
      queryKey: [...configQueries.all(), "settings"] as const,
      queryFn: () => api.getSettings(),
      staleTime: 30_000,
    }),

  init: (api: BoundApi) =>
    queryOptions({
      queryKey: [...configQueries.all(), "init"] as const,
      queryFn: () => api.loadConfigurationInit(),
      staleTime: 5 * 60_000,
    }),

  configurations: (api: BoundApi) =>
    queryOptions({
      queryKey: [...configQueries.all(), "configurations"] as const,
      queryFn: () => api.listConfigurations(),
      staleTime: 30_000,
    }),
};
