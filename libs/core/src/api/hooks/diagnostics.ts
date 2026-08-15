import type { FetchStatus } from "@tanstack/react-query";
import type { DiagnosticsSetupGaps } from "../../schemas/config/configuration-status.js";
import { deriveDiagnosticsSetupGaps } from "../../schemas/config/index.js";
import type { ContextStatus, ServerState } from "../../schemas/presentation/diagnostics.js";
import { isApiError } from "../types.js";
import { useConfigurationInit } from "./config.js";
import { isQueryUnresolved } from "./match-query-state.js";
import { useRefreshReviewContext, useReviewContext } from "./review.js";
import { useServerStatus } from "./server.js";

export interface DiagnosticsData {
  serverState: ServerState;
  retryServer: () => Promise<unknown>;

  setupStatus: DiagnosticsSetupGaps | null;
  initLoading: boolean;
  initError: string | null;

  contextStatus: ContextStatus;
  contextGeneratedAt: string | null;
  contextError: string | null;
  canRegenerate: boolean;

  handleRefreshContext: () => void;
  isRefreshingContext: boolean;

  refetchContext: () => Promise<unknown>;
  refetchInit: () => Promise<unknown>;
}

interface QueryLike {
  isLoading: boolean;
  error: Error | null;
  data: unknown;
  fetchStatus: FetchStatus;
}

function deriveContextStatus(query: QueryLike): ContextStatus {
  if (isQueryUnresolved(query)) return "loading";
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
  // A 404 is the state before the first review, which deriveContextStatus already
  // reports as "missing" in a warning tone. Reporting it as an error too would
  // contradict the card's own status on the state every user starts from.
  if (isApiError(queryError) && queryError.status === 404) return null;
  return queryError.message;
}

export function useDiagnosticsData(): DiagnosticsData {
  const { latestState: serverState, retry: retryServer } = useServerStatus();
  const {
    data: initData,
    isLoading: initLoading,
    error: initErrorObj,
    refetch: refetchInit,
  } = useConfigurationInit();
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
    setupStatus: initData ? deriveDiagnosticsSetupGaps(initData) : null,
    initLoading,
    initError: initErrorObj?.message ?? null,
    contextStatus,
    contextGeneratedAt: contextQuery.data?.meta.generatedAt ?? null,
    contextError,
    canRegenerate: contextStatus === "ready" || contextStatus === "missing",
    handleRefreshContext: () => refreshContext.mutate({ force: true }),
    isRefreshingContext: refreshContext.isPending,
    refetchContext,
    refetchInit: () => refetchInit({ throwOnError: true }),
  };
}

export function refreshAllDiagnostics(
  data: Pick<DiagnosticsData, "retryServer" | "refetchContext" | "refetchInit">,
): Promise<PromiseSettledResult<unknown>[]> {
  return Promise.allSettled([data.retryServer(), data.refetchContext(), data.refetchInit()]);
}
