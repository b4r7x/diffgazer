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
  if (query.data !== undefined) return handlers.success(query.data);
  if (query.error) return handlers.error(query.error);
  return handlers.loading();
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
  if (query.data !== undefined) return null;
  if (query.error) return callbacks.error(query.error);
  return callbacks.loading();
}
