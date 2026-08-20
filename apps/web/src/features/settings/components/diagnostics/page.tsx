import { type DiagnosticsData, useDiagnosticsData } from "@diffgazer/core/api/hooks";
import { formatLocaleDateTimeOrFallback } from "@diffgazer/core/format";
import {
  deriveDiagnosticsActions,
  getContextActionLabel,
  getContextPresentation,
  getServerStatusPresentation,
  getSetupPresentation,
} from "@diffgazer/core/schemas/presentation";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { KeyValue } from "@diffgazer/ui/components/key-value";
import { Panel } from "@diffgazer/ui/components/panel";
import { SectionHeader } from "@diffgazer/ui/components/section-header";
import { useId } from "react";
import { useConfigData } from "@/hooks/use-config";
import { useFocusWithin } from "@/hooks/use-focus-within";
import { useDiagnosticsKeyboard } from "./use-keyboard";

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
  const titleId = useId();
  const { focusWithin, props: focusProps } = useFocusWithin<HTMLDivElement>();
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

  const contextTimestamp = formatLocaleDateTimeOrFallback(contextGeneratedAt, "Unavailable");

  return (
    // Same wrapper padding, width, frame, and corner-label title as CardLayout,
    // plus its own elevation. The panel is written out rather than reusing
    // CardLayout because the diagnostics region is the element that carries
    // aria-busy while a refresh is in flight.
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 md:p-6 lg:p-8">
      <div aria-hidden className="grow" />
      <Panel
        {...focusProps}
        focused={focusWithin}
        aria-labelledby={titleId}
        aria-busy={isRefreshingAll || isRefreshing}
        // Capped to the space below the header so the snapshot list scrolls
        // inside the card and the refresh actions stay on screen.
        className="mx-auto flex w-full min-h-0 max-w-2xl flex-col shadow-lg"
      >
        <Panel.Label>
          <h1 id={titleId}>System Diagnostics</h1>
        </Panel.Label>

        <Panel.Content
          ref={focusFallbackRef}
          tabIndex={-1}
          role="region"
          aria-label="Diagnostic snapshot"
          spacing="none"
          className="min-h-0 flex-1 overflow-y-auto focus:outline-none"
        >
          <Panel.Description className="mb-4">Runtime health for this workspace.</Panel.Description>

          <div className="mb-3 flex items-center justify-between gap-3">
            <SectionHeader as="h2" variant="muted">
              Diagnostic Snapshot
            </SectionHeader>
            <output className="shrink-0 font-mono text-xs text-muted-foreground">
              {OVERALL_STATE_LABELS[overallState]}
            </output>
          </div>

          {/* Below sm the value drops onto its own line instead of competing with
              the label for the same row, which is what overprinted long provider
              strings at 375. */}
          <KeyValue className="font-mono max-sm:grid-cols-1 max-sm:gap-y-1">
            <KeyValue.Item
              label="Health"
              value={<span className="break-all">{server.label}</span>}
              variant={server.variant}
              valueClassName="max-sm:text-left"
            />
            <KeyValue.Item
              label="Setup"
              value={<span className="break-all">{setup.label}</span>}
              variant={setup.variant}
              valueClassName="max-sm:text-left"
            />
            <KeyValue.Item
              label="Provider"
              value={<span className="break-all">{providerValue}</span>}
              variant={provider ? "success" : "warning"}
              valueClassName="max-sm:text-left"
            />
            <KeyValue.Item
              label="Context"
              value={
                <span className="break-all">
                  {context.label}
                  {contextStatus === "ready" && (
                    <span className="ml-2 font-normal text-muted-foreground">
                      {contextTimestamp}
                    </span>
                  )}
                </span>
              }
              variant={context.variant}
              valueClassName="max-sm:text-left"
            />
            <KeyValue.Item
              label="Build"
              value={<span className="break-all">{import.meta.env.MODE.toUpperCase()}</span>}
              valueClassName="max-sm:text-left"
            />
            <KeyValue.Item
              label="Refreshed"
              value={
                <span className="break-all">
                  {formatLocaleDateTimeOrFallback(lastRefreshedAt, "Unavailable")}
                </span>
              }
              valueClassName="font-normal text-muted-foreground max-sm:text-left"
            />
          </KeyValue>

          {diagnosticsError && (
            <Callout tone="error" live className="mt-6">
              <Callout.Content>{diagnosticsError}</Callout.Content>
            </Callout>
          )}
        </Panel.Content>

        {/* Centered while the actions stack on a narrow screen — right-aligning
            two buttons of different widths leaves a ragged column — and back to
            the trailing edge once they sit on one row. */}
        <Panel.Footer className="justify-center gap-3 sm:justify-end">
          <fieldset className="flex min-w-0 flex-wrap justify-center gap-3 border-0 p-0 sm:justify-end">
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
              variant="primary"
              size="sm"
              bracket
              disabled={isContextActionDisabled}
              highlighted={focusedIndex === 1 && !isContextActionDisabled}
              onClick={() => void handleRefreshContext()}
            >
              {contextActionLabel}
            </Button>
          </fieldset>
        </Panel.Footer>
      </Panel>
      <div aria-hidden className="grow-[2]" />
    </div>
  );
}
