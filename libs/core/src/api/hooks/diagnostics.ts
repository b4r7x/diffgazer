import type { SetupStatus } from "@diffgazer/core/schemas/config";
import { useServerStatus, type ServerState } from "./server.js";
import { useInit } from "./config.js";
import { useReviewContext, useRefreshReviewContext } from "./review.js";

export type ContextStatus = "loading" | "ready" | "missing" | "error";

export interface DiagnosticsData {
  // Server
  serverState: ServerState;
  retryServer: () => void;

  // Setup (from useInit)
  setupStatus: SetupStatus | null;
  initLoading: boolean;
  initError: string | null;

  // Context
  contextStatus: ContextStatus;
  contextGeneratedAt: string | null;
  contextError: string | null;
  canRegenerate: boolean;

  // Context refresh
  handleRefreshContext: () => void;
  isRefreshingContext: boolean;

  // Raw refetch for platform-specific needs (e.g., "refresh all")
  refetchContext: () => void;
}

interface QueryLike {
  isLoading: boolean;
  error: Error | null;
  data: unknown;
}

function deriveContextStatus(query: QueryLike): ContextStatus {
  if (query.isLoading) return "loading";
  if (query.error) {
    const status = "status" in query.error
      ? (query.error as { status?: number }).status
      : undefined;
    return status === 404 ? "missing" : "error";
  }
  if (query.data) return "ready";
  return "missing";
}

function deriveContextError(
  queryError: Error | null,
  refreshError: Error | null,
): string | null {
  if (refreshError) return refreshError.message;
  if (!queryError) return null;
  return queryError.message;
}

export function useDiagnosticsData(): DiagnosticsData {
  const { state: serverState, retry: retryServer } = useServerStatus();
  const { data: initData, isLoading: initLoading, error: initErrorObj } = useInit();
  const contextQuery = useReviewContext();
  const refreshContext = useRefreshReviewContext();

  const contextStatus = deriveContextStatus(contextQuery);
  const contextError = deriveContextError(contextQuery.error, refreshContext.error);

  return {
    serverState,
    retryServer,
    setupStatus: initData?.setup ?? null,
    initLoading,
    initError: initErrorObj?.message ?? null,
    contextStatus,
    contextGeneratedAt: contextQuery.data?.meta.generatedAt ?? null,
    contextError,
    canRegenerate: contextStatus === "ready" || contextStatus === "missing",
    handleRefreshContext: () => refreshContext.mutate({ force: true }),
    isRefreshingContext: refreshContext.isPending,
    refetchContext: () => { contextQuery.refetch(); },
  };
}
