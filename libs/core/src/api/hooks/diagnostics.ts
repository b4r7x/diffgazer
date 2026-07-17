import type { SetupStatus } from "../../schemas/config/index.js";
import type { BadgeVariant } from "../../schemas/presentation/index.js";
import { useInit } from "./config.js";
import { useRefreshReviewContext, useReviewContext } from "./review.js";
import { type ServerState, useServerStatus } from "./server.js";

export type ContextStatus = "loading" | "ready" | "missing" | "error";

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
    const status =
      "status" in query.error ? (query.error as { status?: number }).status : undefined;
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

export interface DiagnosticsPresentation {
  label: string;
  variant: Extract<BadgeVariant, "success" | "warning" | "error" | "info">;
}

export function getServerStatusPresentation(serverState: ServerState): DiagnosticsPresentation {
  if (serverState.status === "checking") return { label: "Checking...", variant: "info" };
  if (serverState.status === "connected") return { label: "Connected", variant: "success" };
  return { label: `Error: ${serverState.message}`, variant: "error" };
}

export interface SetupPresentationInput {
  isLoading: boolean;
  error: string | null;
  setupStatus: SetupStatus | null;
}

export function getSetupPresentation({
  isLoading,
  error,
  setupStatus,
}: SetupPresentationInput): DiagnosticsPresentation {
  if (isLoading) return { label: "Loading...", variant: "info" };
  if (error) return { label: `Error: ${error}`, variant: "error" };
  if (!setupStatus) return { label: "Unavailable", variant: "warning" };
  if (setupStatus.isReady) return { label: "Ready", variant: "success" };
  return {
    label: `Incomplete (${setupStatus.missing.join(", ") || "unknown"})`,
    variant: "warning",
  };
}

const CONTEXT_VARIANT_BY_STATUS = {
  ready: "success",
  missing: "warning",
  loading: "info",
  error: "error",
} as const satisfies Record<ContextStatus, DiagnosticsPresentation["variant"]>;

export function getContextPresentation(
  status: ContextStatus,
  errorMessage: string | null,
): DiagnosticsPresentation {
  if (status === "loading") {
    return { label: "Loading...", variant: CONTEXT_VARIANT_BY_STATUS.loading };
  }
  if (status === "ready") return { label: "Ready", variant: CONTEXT_VARIANT_BY_STATUS.ready };
  if (status === "missing") {
    return { label: "Missing", variant: CONTEXT_VARIANT_BY_STATUS.missing };
  }
  return { label: `Error: ${errorMessage ?? "unknown"}`, variant: CONTEXT_VARIANT_BY_STATUS.error };
}

export function getContextActionLabel(isRefreshing: boolean, status: ContextStatus): string {
  if (isRefreshing) return "Regenerating...";
  if (status === "ready") return "Regenerate Context";
  return "Generate Context";
}

export interface DiagnosticsActionsInput {
  canRegenerate: boolean;
  isRefreshing: boolean;
  isRefreshingAll: boolean;
}

export interface DiagnosticsActions {
  refreshAllDisabled: boolean;
  contextActionDisabled: boolean;
}

export function deriveDiagnosticsActions({
  canRegenerate,
  isRefreshing,
  isRefreshingAll,
}: DiagnosticsActionsInput): DiagnosticsActions {
  return {
    refreshAllDisabled: isRefreshingAll || isRefreshing,
    contextActionDisabled: !canRegenerate || isRefreshing || isRefreshingAll,
  };
}

export function refreshAllDiagnostics(
  data: Pick<DiagnosticsData, "retryServer" | "refetchContext">,
): Promise<PromiseSettledResult<unknown>[]> {
  return Promise.allSettled([data.retryServer(), data.refetchContext()]);
}
