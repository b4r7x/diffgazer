import { QueryClient, type QueryClientConfig } from "@tanstack/react-query";

function isClientHttpError(error: unknown): boolean {
  if (!(error instanceof Error) || !("status" in error)) return false;
  const status = (error as Error & { status: unknown }).status;
  return typeof status === "number" && status >= 400 && status < 500;
}

/**
 * Builds a retry predicate that gives up on 4xx responses and retries other
 * failures up to `maxFailures` times. Surfaces (web, TUI) cap the attempts
 * without losing the shared 4xx give-up policy.
 */
export function createQueryRetry(
  maxFailures: number,
): (failureCount: number, error: unknown) => boolean {
  return (failureCount, error) => !isClientHttpError(error) && failureCount < maxFailures;
}

const baseQueries: QueryClientConfig["defaultOptions"] = {
  queries: {
    staleTime: 60_000,
    retry: createQueryRetry(2),
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
