import { QueryClient } from "@tanstack/react-query";

export function createCliQueryClient() {
  return new QueryClient({
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
