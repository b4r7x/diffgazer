import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";

function isClientHttpError(error: unknown): boolean {
  if (!(error instanceof Error) || !("status" in error)) return false;
  const status = (error as Error & { status: unknown }).status;
  return typeof status === "number" && status >= 400 && status < 500;
}

const baseQueries: QueryClientConfig["defaultOptions"] = {
  queries: {
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (isClientHttpError(error)) return false;
      return failureCount < 2;
    },
  },
};

/**
 * Creates a QueryClient seeded with shared defaults (60s stale time and a retry
 * policy that gives up on 4xx responses). Callers pass `overrides` to replace or
 * extend the query/mutation defaults for their environment.
 */
export function createQueryClientBase(overrides?: QueryClientConfig): QueryClient {
  return new QueryClient({
    ...overrides,
    defaultOptions: {
      ...baseQueries,
      ...overrides?.defaultOptions,
      queries: {
        ...baseQueries?.queries,
        ...overrides?.defaultOptions?.queries,
      },
    },
  });
}
