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
      queryFn: () => api.loadInit(),
      staleTime: 5 * 60_000,
    }),

  check: (api: BoundApi) =>
    queryOptions({
      queryKey: [...configQueries.all(), "check"] as const,
      queryFn: () => api.checkConfig(),
      staleTime: 30_000,
    }),

  providers: (api: BoundApi) =>
    queryOptions({
      queryKey: [...configQueries.all(), "providers"] as const,
      queryFn: () => api.getProviderStatus(),
      staleTime: 30_000,
    }),

  openRouterModels: (api: BoundApi) =>
    queryOptions({
      queryKey: [...configQueries.all(), "openrouter-models"] as const,
      queryFn: () => api.getOpenRouterModels(),
      staleTime: 5 * 60_000,
    }),
};
