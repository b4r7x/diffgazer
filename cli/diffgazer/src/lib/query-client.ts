import { createQueryClientBase, createQueryRetry } from "@diffgazer/core/api";

const TUI_QUERY_MAX_FAILURES = 3;

export function createCliQueryClient() {
  return createQueryClientBase({
    defaultOptions: {
      queries: {
        networkMode: "always",
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: createQueryRetry(TUI_QUERY_MAX_FAILURES),
        staleTime: 30_000,
      },
      mutations: {
        networkMode: "always",
      },
    },
  });
}
