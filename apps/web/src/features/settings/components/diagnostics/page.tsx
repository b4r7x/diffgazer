import {
  type DiagnosticsData,
  deriveDiagnosticsActions,
  getContextActionLabel,
  getContextPresentation,
  getServerStatusPresentation,
  getSetupPresentation,
  useDiagnosticsData,
} from "@diffgazer/core/api/hooks";
import { formatTimestampOrNA } from "@diffgazer/core/format";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { Divider } from "@diffgazer/ui/components/divider";
import { KeyValue } from "@diffgazer/ui/components/key-value";
import { Panel } from "@diffgazer/ui/components/panel";
import { Typography } from "@diffgazer/ui/components/typography";
import { useConfigData } from "@/hooks/use-config";
import { useDiagnosticsKeyboard } from "./use-diagnostics-keyboard";

type OverallState = "loading" | "error" | "empty" | "success";

const OVERALL_STATE_LABELS = {
  loading: "Checking",
  error: "Needs attention",
  empty: "Setup needed",
  success: "Ready",
} satisfies Record<OverallState, string>;

function getProviderValue(provider: string | undefined, model: string | undefined): string {
  if (!provider) return "Unavailable";
  if (model) return `${provider} (${model})`;
  return provider;
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

export function SettingsDiagnosticsPage() {
  const { provider, model } = useConfigData();
  const diagnostics = useDiagnosticsData();
  const {
    serverState,
    setupStatus,
    initLoading,
    initError,
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

  const server = getServerStatusPresentation(serverState);
  const setup = getSetupPresentation({ isLoading: initLoading, error: initError, setupStatus });
  const providerValue = getProviderValue(provider, model);
  const context = getContextPresentation(contextStatus, contextError);
  const contextActionLabel = getContextActionLabel(isRefreshing, contextStatus);
  const serverError = serverState.status === "error" ? serverState.message : null;
  const diagnosticsError = refreshError ?? contextError ?? serverError;
  const {
    refreshAllDisabled: isRefreshAllDisabled,
    contextActionDisabled: isContextActionDisabled,
  } = deriveDiagnosticsActions({ canRegenerate, isRefreshing, isRefreshingAll });
  const overallState = getOverallState({ isRefreshingAll, serverState, contextStatus, provider });

  return (
    <div className="flex flex-1 overflow-hidden px-4 justify-center items-center">
      <Panel
        as="section"
        aria-label="system diagnostics"
        aria-busy={isRefreshingAll || isRefreshing}
        className="w-full max-w-2xl flex flex-col border-border bg-background shadow-lg"
      >
        <Panel.Header className="bg-secondary border-border px-4 py-2">
          <Panel.Title className="text-foreground">System Diagnostics</Panel.Title>
          <span className="text-xs text-muted-foreground">
            {OVERALL_STATE_LABELS[overallState]}
          </span>
        </Panel.Header>

        <Panel.Content
          ref={focusFallbackRef}
          tabIndex={-1}
          className="p-6 space-y-8 focus:outline-none"
        >
          <div className="grid grid-cols-2 gap-x-8 text-sm">
            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                Version Info
              </span>
              <div className="flex items-center gap-2">
                <span className="text-info-text">Diffgazer Web</span>
                <span className="text-border">|</span>
                <span className="text-success-text">{import.meta.env.MODE.toUpperCase()}</span>
              </div>
            </div>

            <div className="flex flex-col">
              <span className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                Context Snapshot
              </span>
              <div className="text-foreground flex items-center gap-2">
                <span>{context.label}</span>
                {contextStatus === "ready" && (
                  <span className="text-xs text-warning-text">
                    {formatTimestampOrNA(contextGeneratedAt, "Unavailable")}
                  </span>
                )}
              </div>
            </div>
          </div>

          <Divider className="border-dashed" />

          <div className="space-y-3">
            <Typography as="h3" size="xs" className="text-accent uppercase tracking-wider">
              Diagnostic Snapshot
            </Typography>
            <KeyValue className="font-mono">
              <KeyValue.Item
                label="Health"
                value={<span className="break-all">{server.label}</span>}
                variant={server.variant}
              />
              <KeyValue.Item
                label="Setup"
                value={<span className="break-all">{setup.label}</span>}
                variant={setup.variant}
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
