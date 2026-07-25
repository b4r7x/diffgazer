import type { UseQueryResult } from "@tanstack/react-query";
import type { ReactElement, ReactNode } from "react";

interface QueryStateHandlers<T> {
  loading: () => ReactNode;
  error: (err: Error) => ReactNode;
  success: (data: T) => ReactNode;
}

type QueryPhase<T> =
  | { status: "loading" }
  | { status: "error"; error: Error }
  | { status: "success"; data: T }
  | { status: "idle" };

function resolveQueryPhase<T>(query: UseQueryResult<T>): QueryPhase<T> {
  if (query.isLoading) return { status: "loading" };
  // Error takes precedence over stale data: a refetch failure leaves both
  // `data` (previous success) and `error` populated, and the UI should
  // surface the error rather than silently render outdated content.
  if (query.error) return { status: "error", error: query.error };
  if (query.data !== undefined) return { status: "success", data: query.data };
  // A disabled query (`enabled: false`) is `isLoading: false` with no data and
  // `fetchStatus: "idle"`. Only report loading when a fetch is actually running;
  // otherwise the caller must not be stuck behind a spinner that never resolves.
  if (query.fetchStatus !== "idle") return { status: "loading" };
  return { status: "idle" };
}

export function matchQueryState<T>(
  query: UseQueryResult<T>,
  handlers: QueryStateHandlers<T>,
): ReactNode {
  const phase = resolveQueryPhase(query);
  if (phase.status === "loading") return handlers.loading();
  if (phase.status === "error") return handlers.error(phase.error);
  if (phase.status === "success") return handlers.success(phase.data);
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
  const phase = resolveQueryPhase(query);
  if (phase.status === "loading") return callbacks.loading();
  if (phase.status === "error") return callbacks.error(phase.error);
  return null;
}
