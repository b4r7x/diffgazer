export type ContextStatus = "loading" | "ready" | "missing" | "error";

export interface DiagnosticsActionInput {
  canRegenerate: boolean;
  isRefreshing: boolean;
  contextStatus: ContextStatus;
}

export interface DiagnosticsActionState {
  contextActionLabel: string;
  contextActionDisabled: boolean;
}

function getContextActionLabel(
  isRefreshing: boolean,
  contextStatus: ContextStatus,
): string {
  if (isRefreshing) return "Regenerating...";
  if (contextStatus === "ready") return "Regenerate Context";
  return "Generate Context";
}

export function deriveDiagnosticsActions({
  canRegenerate,
  isRefreshing,
  contextStatus,
}: DiagnosticsActionInput): DiagnosticsActionState {
  return {
    contextActionLabel: getContextActionLabel(isRefreshing, contextStatus),
    contextActionDisabled: !canRegenerate || isRefreshing,
  };
}

export interface DiagnosticsRefreshAllTrigger {
  retryServer: () => Promise<unknown>;
  refetchContext: () => Promise<unknown>;
}

export function triggerDiagnosticsRefreshAll(
  trigger: DiagnosticsRefreshAllTrigger,
): Promise<PromiseSettledResult<unknown>[]> {
  return Promise.allSettled([trigger.retryServer(), trigger.refetchContext()]);
}
