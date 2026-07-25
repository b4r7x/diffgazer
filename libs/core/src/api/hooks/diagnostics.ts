import type { SetupStatus } from "../../schemas/config/index.js";
import type { ContextStatus, ServerState } from "../../schemas/presentation/diagnostics.js";
import { isApiError } from "../types.js";
import { useInit } from "./config.js";
import { useRefreshReviewContext, useReviewContext } from "./review.js";
import { useServerStatus } from "./server.js";

export interface DiagnosticsData {
  serverState: ServerState;
  retryServer: () => Promise<unknown>;

  setupStatus: SetupStatus | null;
  initLoading: boolean;
  initError: string | null;

  contextStatus: ContextStatus;
  contextGeneratedAt: string | null;
  contextError: string | null;
  canRegenerate: boolean;

  handleRefreshContext: () => void;
  isRefreshingContext: boolean;

  // Raw refetch for platform-specific needs (e.g., "refresh all")
  refetchContext: () => Promise<unknown>;
}

interface QueryLike {
  isLoading: boolean;
  error: Error | null;
  data: unknown;
}

function deriveContextStatus(query: QueryLike): ContextStatus {
  if (query.isLoading) return "loading";
  if (query.error) {
    const status = isApiError(query.error) ? query.error.status : undefined;
    return status === 404 ? "missing" : "error";
  }
  if (query.data) return "ready";
  return "missing";
}

function deriveContextError(queryError: Error | null, refreshError: Error | null): string | null {
  if (refreshError) return refreshError.message;
  if (!queryError) return null;
  return queryError.message;
}

export function useDiagnosticsData(): DiagnosticsData {
  const { latestState: serverState, retry: retryServer } = useServerStatus();
  const { data: initData, isLoading: initLoading, error: initErrorObj } = useInit();
  const contextQuery = useReviewContext();
  const refreshContext = useRefreshReviewContext();

  const contextStatus = deriveContextStatus(contextQuery);
  const contextError = deriveContextError(contextQuery.error, refreshContext.error);
  const refetchContext = async () => {
    const result = await contextQuery.refetch({ throwOnError: true });
    refreshContext.reset();
    return result;
  };

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
    refetchContext,
  };
}

export function refreshAllDiagnostics(
  data: Pick<DiagnosticsData, "retryServer" | "refetchContext">,
): Promise<PromiseSettledResult<unknown>[]> {
  return Promise.allSettled([data.retryServer(), data.refetchContext()]);
}
