import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";

interface QueryStateHandlers<T> {
  loading: () => ReactNode;
  error: (err: Error) => ReactNode;
  success: (data: T) => ReactNode;
}

export function matchQueryState<T>(
  query: UseQueryResult<T>,
  handlers: QueryStateHandlers<T>,
): ReactNode {
  if (query.isLoading) return handlers.loading();
  // Error takes precedence over stale data: a refetch failure leaves both
  // `data` (previous success) and `error` populated, and the UI should
  // surface the error rather than silently render outdated content.
  if (query.error) return handlers.error(query.error);
  if (query.data !== undefined) return handlers.success(query.data);
  // A disabled query (`enabled: false`) is `isLoading: false` with no data and
  // `fetchStatus: "idle"`. Only show loading when a fetch is actually running;
  // otherwise render nothing so the caller is not stuck behind a fake spinner.
  if (query.fetchStatus !== "idle") return handlers.loading();
  return null;
}

/**
 * Guard variant of matchQueryState. Returns ReactElement for loading/error,
 * or null when data is available (allowing the caller to proceed with typed data).
 */
export function guardQueryState<T>(
  query: UseQueryResult<T>,
  callbacks: {
    loading: () => ReactElement;
    error: (error: Error) => ReactElement;
  },
): ReactElement | null {
  if (query.isLoading) return callbacks.loading();
  if (query.error) return callbacks.error(query.error);
  if (query.data !== undefined) return null;
  // A disabled query (`enabled: false`) is idle with no data; do not return a
  // loading element that would never resolve. Only guard while a fetch runs.
  if (query.fetchStatus !== "idle") return callbacks.loading();
  return null;
}
