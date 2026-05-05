import { QueryClient } from "@tanstack/react-query";

export function createWebQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 2,
      },
    },
  });
}
