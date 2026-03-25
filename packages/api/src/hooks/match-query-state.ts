import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactNode } from "react";

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
