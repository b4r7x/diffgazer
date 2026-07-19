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
  setupStatus,
  initLoading,
  initError,
}: {
  isRefreshingAll: boolean;
  serverState: DiagnosticsData["serverState"];
  contextStatus: DiagnosticsData["contextStatus"];
  provider: string | undefined;
  setupStatus: DiagnosticsData["setupStatus"];
  initLoading: boolean;
  initError: string | null;
}): OverallState {
  if (serverState.status === "error" || contextStatus === "error" || initError) return "error";
  if (
    isRefreshingAll ||
    serverState.status === "checking" ||
    contextStatus === "loading" ||
    initLoading
  ) {
    return "loading";
  }
  if (!provider || !setupStatus?.isReady || contextStatus === "missing") return "empty";
  return "success";
}

export function SettingsDiagnosticsPage() {
  const { provider, model } = useConfigData();
  const diagnostics = useDiagnosticsData();
  const {
    setupStatus,
    initLoading,
    initError,
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
    lastRefreshedAt,
    handleRefreshAll,
  } = useDiagnosticsKeyboard({ diagnostics });

  const server = getServerStatusPresentation(serverState);
  const setup = getSetupPresentation({ isLoading: initLoading, error: initError, setupStatus });
  const providerValue = getProviderValue(provider, model);
  const context = getContextPresentation(contextStatus, contextError);
  const contextActionLabel = getContextActionLabel(isRefreshing, contextStatus);
  const serverError = serverState.status === "error" ? serverState.message : null;
  const diagnosticsError = initError ?? contextError ?? serverError;
  const {
    refreshAllDisabled: isRefreshAllDisabled,
    contextActionDisabled: isContextActionDisabled,
  } = deriveDiagnosticsActions({ canRegenerate, isRefreshing, isRefreshingAll });
  const overallState = getOverallState({
    isRefreshingAll,
    serverState,
    contextStatus,
    provider,
    setupStatus,
    initLoading,
    initError,
  });

  return (
    <div className="flex flex-1 overflow-y-auto px-4">
      <Panel
        as="section"
        aria-label="system diagnostics"
        aria-busy={isRefreshingAll || isRefreshing}
        className="m-auto flex w-full max-w-2xl flex-col border-border bg-background shadow-lg"
      >
        <Panel.Header className="bg-secondary border-border px-4 py-2">
          <Panel.Title className="text-foreground">System Diagnostics</Panel.Title>
          <output className="text-xs text-muted-foreground">
            {OVERALL_STATE_LABELS[overallState]}
          </output>
        </Panel.Header>

        <Panel.Content
          ref={focusFallbackRef}
          tabIndex={-1}
          className="p-6 space-y-8 focus:outline-none"
        >
          <div className="grid grid-cols-1 gap-y-4 text-sm sm:grid-cols-2 sm:gap-x-8">
            <div className="flex min-w-0 flex-col">
              <span className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                Version Info
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-info-text">Diffgazer Web</span>
                <span className="text-border">|</span>
                <span className="break-all text-success-text">
                  {import.meta.env.MODE.toUpperCase()}
                </span>
              </div>
            </div>

            <div className="flex min-w-0 flex-col">
              <span className="text-muted-foreground text-xs uppercase tracking-wider mb-1">
                Context Snapshot
              </span>
              <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-foreground">
                <span className="break-words">{context.label}</span>
                {contextStatus === "ready" && (
                  <span className="break-words text-xs text-warning-text">
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

          <fieldset className="flex min-w-0 flex-wrap gap-4 border-0 p-0 pt-2">
            <legend className="sr-only">Diagnostics actions</legend>
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
          </fieldset>

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
