import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

interface QueryStateHandlers<T> {
  loading: () => ReactNode;
  error: (err: Error) => ReactNode;
  empty?: (data: T) => boolean;
  success: (data: T) => ReactNode;
}

export function matchQueryState<T>(
  query: UseQueryResult<T>,
  handlers: QueryStateHandlers<T>,
): ReactNode {
  if (query.isLoading) return handlers.loading();
  if (query.error) return handlers.error(query.error);
  if (query.data !== undefined) {
    if (handlers.empty?.(query.data)) return handlers.loading();
    return handlers.success(query.data);
  }
  return handlers.loading();
}
