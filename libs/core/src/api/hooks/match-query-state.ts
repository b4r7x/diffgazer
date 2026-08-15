import type { FetchStatus } from "@tanstack/react-query";
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

/**
 * The only fields these helpers read. A full `UseQueryResult` satisfies it
 * structurally, so narrowing here costs callers nothing and keeps a later field
 * dependency type-visible instead of silently `undefined` in test fixtures.
 */
export type QueryState<T> = {
  isLoading: boolean;
  error: Error | null;
  data: T | undefined;
  fetchStatus: FetchStatus;
};

/** True while a query has not yet resolved to data, an error, or an idle disabled state. */
export function isQueryUnresolved<T>(query: QueryState<T>): boolean {
  if (query.isLoading) return true;
  if (query.error) return false;
  if (query.data !== undefined) return false;
  return query.fetchStatus !== "idle";
}

function resolveQueryPhase<T>(query: QueryState<T>): QueryPhase<T> {
  if (isQueryUnresolved(query)) return { status: "loading" };
  if (query.error) return { status: "error", error: query.error };
  if (query.data !== undefined) return { status: "success", data: query.data };
  return { status: "idle" };
}

export function matchQueryState<T>(
  query: QueryState<T>,
  handlers: QueryStateHandlers<T>,
): ReactNode {
  const phase = resolveQueryPhase(query);
  switch (phase.status) {
    case "loading":
      return handlers.loading();
    case "error":
      return handlers.error(phase.error);
    case "success":
      return handlers.success(phase.data);
    case "idle":
      return null;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}

/**
 * Guard variant of matchQueryState. Returns ReactElement for loading/error,
 * or null when data is available (allowing the caller to proceed with typed data).
 */
export function guardQueryState<T>(
  query: QueryState<T>,
  callbacks: {
    loading: () => ReactElement;
    error: (error: Error) => ReactElement;
  },
): ReactElement | null {
  const phase = resolveQueryPhase(query);
  switch (phase.status) {
    case "loading":
      return callbacks.loading();
    case "error":
      return callbacks.error(phase.error);
    // The caller renders both resolved phases itself: success has typed data,
    // and an idle disabled query has nothing to show.
    case "success":
    case "idle":
      return null;
    default: {
      const _exhaustive: never = phase;
      return _exhaustive;
    }
  }
}
