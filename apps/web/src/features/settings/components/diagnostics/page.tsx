import { type DiagnosticsData, useDiagnosticsData } from "@diffgazer/core/api/hooks";
import { formatTimestampOrNA } from "@diffgazer/core/format";
import type { SetupStatus } from "@diffgazer/core/schemas/config";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { Divider } from "@diffgazer/ui/components/divider";
import { KeyValue } from "@diffgazer/ui/components/key-value";
import { Panel } from "@diffgazer/ui/components/panel";
import { Typography } from "@diffgazer/ui/components/typography";
import { useConfigData } from "@/hooks/use-config";
import { useDiagnosticsKeyboard } from "./use-diagnostics-keyboard";

type OverallState = "loading" | "error" | "empty" | "success";

function getServerValue(serverState: DiagnosticsData["serverState"]): string {
  if (serverState.status === "checking") return "Checking...";
  if (serverState.status === "connected") return "Connected";
  return `Error: ${serverState.message}`;
}

const HEALTH_VARIANT_BY_STATUS = {
  error: "error",
  connected: "success",
  checking: "info",
} as const satisfies Record<DiagnosticsData["serverState"]["status"], "error" | "success" | "info">;

function getHealthVariant(
  status: DiagnosticsData["serverState"]["status"],
): "error" | "success" | "info" {
  return HEALTH_VARIANT_BY_STATUS[status];
}

function getSetupValue(setupStatus: SetupStatus | null): string {
  if (!setupStatus) return "Unavailable";
  if (setupStatus.isReady) return "Ready";
  return `Incomplete (${setupStatus.missing.join(", ") || "unknown"})`;
}

function getProviderValue(provider: string | undefined, model: string | undefined): string {
  if (!provider) return "Unavailable";
  if (model) return `${provider} (${model})`;
  return provider;
}

function getContextActionLabel(
  isRefreshing: boolean,
  contextStatus: DiagnosticsData["contextStatus"],
): string {
  if (isRefreshing) return "Working...";
  if (contextStatus === "ready") return "Regenerate Context";
  return "Generate Context";
}

function getOverallState({
  isRefreshingAll,
  serverState,
  contextStatus,
  provider,
}: {
  isRefreshingAll: boolean;
  serverState: DiagnosticsData["serverState"];
  contextStatus: DiagnosticsData["contextStatus"];
  provider: string | undefined;
}): OverallState {
  if (isRefreshingAll || serverState.status === "checking" || contextStatus === "loading")
    return "loading";
  if (serverState.status === "error" && contextStatus === "error") return "error";
  if (!provider && contextStatus === "missing") return "empty";
  return "success";
}

export function DiagnosticsPage() {
  const { provider, model, setupStatus } = useConfigData();
  const diagnostics = useDiagnosticsData();
  const {
    serverState,
    contextStatus,
    contextGeneratedAt,
    contextError,
    canRegenerate,
    handleRefreshContext,
    isRefreshingContext: isRefreshing,
  } = diagnostics;

  const {
    focusedIndex,
    getActionProps,
    focusFallbackRef,
    isRefreshingAll,
    refreshError,
    lastRefreshedAt,
    handleRefreshAll,
  } = useDiagnosticsKeyboard({ diagnostics });

  const serverValue = getServerValue(serverState);
  const setupValue = getSetupValue(setupStatus);
  const providerValue = getProviderValue(provider, model);
  const contextActionLabel = getContextActionLabel(isRefreshing, contextStatus);
  const serverError = serverState.status === "error" ? serverState.message : null;
  const diagnosticsError = refreshError ?? contextError ?? serverError;
  const isRefreshAllDisabled = isRefreshingAll || isRefreshing;
  const isContextActionDisabled = !canRegenerate || isRefreshing || isRefreshingAll;
  const overallState = getOverallState({ isRefreshingAll, serverState, contextStatus, provider });

  return (
    <div className="flex flex-1 overflow-hidden px-4 justify-center items-center">
      <Panel
        as="section"
        aria-label="system diagnostics"
        aria-busy={isRefreshingAll || isRefreshing}
        className="w-full max-w-2xl flex flex-col border-tui-border bg-tui-bg shadow-lg"
      >
        <Panel.Header className="bg-tui-selection border-tui-border px-4 py-2">
          <Panel.Title className="text-tui-fg">System Diagnostics</Panel.Title>
          <span className="text-xs text-tui-muted">{overallState}</span>
        </Panel.Header>

        <Panel.Content
          ref={focusFallbackRef}
          tabIndex={-1}
          className="p-6 space-y-8 focus:outline-none"
        >
          <div className="grid grid-cols-2 gap-x-8 text-sm">
            <div className="flex flex-col">
              <span className="text-tui-muted text-xs uppercase tracking-wider mb-1">
                Version Info
              </span>
              <div className="flex items-center gap-2">
                <span className="text-tui-blue">Diffgazer Web</span>
                <span className="text-tui-border">|</span>
                <span className="text-tui-green">{import.meta.env.MODE.toUpperCase()}</span>
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-tui-muted text-xs uppercase tracking-wider mb-1">
                Context Snapshot
              </span>
              <div className="text-white flex items-center gap-2">
                <span>[{contextStatus}]</span>
                {contextStatus === "ready" && (
                  <span className="text-xs text-tui-yellow">
                    {formatTimestampOrNA(contextGeneratedAt, "Unavailable")}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Divider className="border-dashed" />

          <div className="space-y-3">
            <Typography as="h3" size="xs" className="text-tui-violet uppercase tracking-wider">
              Diagnostic Snapshot
            </Typography>
            <KeyValue className="font-mono">
              <KeyValue.Item
                label="Health"
                value={<span className="break-all">{serverValue}</span>}
                variant={getHealthVariant(serverState.status)}
              />
              <KeyValue.Item
                label="Setup"
                value={<span className="break-all">{setupValue}</span>}
                variant={setupStatus?.isReady ? "success" : "warning"}
              />
              <KeyValue.Item
                label="Provider"
                value={<span className="break-all">{providerValue}</span>}
                variant={provider ? "success" : "warning"}
              />
              <KeyValue.Item
                label="Refreshed"
                value={
                  <span className="break-all">
                    {formatTimestampOrNA(lastRefreshedAt, "Unavailable")}
                  </span>
                }
                variant="info"
              />
            </KeyValue>
          </div>

          <Divider className="border-dashed" />

          <div className="flex gap-4 pt-2">
            <Button
              {...getActionProps(0)}
              variant="secondary"
              size="sm"
              bracket
              disabled={isRefreshAllDisabled}
              highlighted={focusedIndex === 0 && !isRefreshAllDisabled}
              onClick={() => void handleRefreshAll()}
            >
              {isRefreshingAll ? "Refreshing..." : "Refresh Diagnostics"}
            </Button>
            <Button
              {...getActionProps(1)}
              variant="success"
              size="sm"
              bracket
              disabled={isContextActionDisabled}
              highlighted={focusedIndex === 1 && !isContextActionDisabled}
              onClick={() => void handleRefreshContext()}
            >
              {contextActionLabel}
            </Button>
          </div>

          {diagnosticsError && (
            <Callout tone="error" live className="text-sm">
              <Callout.Content>{diagnosticsError}</Callout.Content>
            </Callout>
          )}
        </Panel.Content>
      </Panel>
    </div>
  );
}
