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

export function deriveDiagnosticsActions({
  canRegenerate,
  isRefreshing,
  contextStatus,
}: DiagnosticsActionInput): DiagnosticsActionState {
  const label = isRefreshing
    ? "Regenerating..."
    : contextStatus === "ready"
      ? "Regenerate Context"
      : "Generate Context";
  return {
    contextActionLabel: label,
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
