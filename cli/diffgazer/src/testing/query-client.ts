import { QueryClient } from "@tanstack/react-query";

/** One test-query policy: no retries, and never treat the offline test env as offline. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, networkMode: "always" },
      mutations: { retry: false, networkMode: "always" },
    },
  });
}
