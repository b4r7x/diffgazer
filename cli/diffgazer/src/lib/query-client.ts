import { createQueryClientBase } from "@diffgazer/core/api";

export function createCliQueryClient() {
  return createQueryClientBase({
    defaultOptions: {
      queries: {
        networkMode: "always",
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: 1,
        staleTime: 30_000,
      },
      mutations: {
        networkMode: "always",
      },
    },
  });
}
