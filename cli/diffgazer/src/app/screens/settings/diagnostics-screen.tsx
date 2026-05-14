import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { Spinner } from "../../../components/ui/spinner.js";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useSettingsZone } from "../../../hooks/use-settings-zone.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { useDiagnosticsData } from "@diffgazer/core/api/hooks";
import { formatTimestampOrNA } from "@diffgazer/core/format";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { Badge } from "../../../components/ui/badge.js";
import { KeyValue } from "../../../components/ui/key-value.js";
import {
  deriveDiagnosticsActions,
  triggerDiagnosticsRefreshAll,
} from "../../../features/settings/diagnostics/derive-actions.js";

export function DiagnosticsScreen(): ReactElement {
  const { columns } = useTerminalDimensions();
  useScope("settings-diagnostics");
  useBackHandler();

  const {
    serverState,
    retryServer,
    setupStatus,
    initLoading,
    initError,
    contextStatus,
    contextGeneratedAt,
    contextError,
    canRegenerate,
    handleRefreshContext: handleRegenerateContext,
    isRefreshingContext: isRefreshing,
    refetchContext,
  } = useDiagnosticsData();

  const { isButtonActive } = useSettingsZone({
    buttonCount: 2,
    disabled: isRefreshing,
  });

  usePageFooter({
    shortcuts: [
      { key: "←→", label: "Move action" },
      { key: "Enter", label: "Activate" },
    ],
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  });

  const handleRefreshAll = () => {
    void triggerDiagnosticsRefreshAll({ retryServer, refetchContext });
  };

  const { contextActionLabel, contextActionDisabled } = deriveDiagnosticsActions({
    canRegenerate,
    isRefreshing,
    contextStatus,
  });

  const serverStatus = serverState.status;
  const serverError = serverState.status === "error" ? serverState.message : null;
  const nodeVersion = process.version;

  const serverBadgeVariant = serverStatus === "connected" ? "success"
    : serverStatus === "checking" ? "info"
    : "error";

  const serverLabel = serverStatus === "checking" ? "checking..."
    : serverStatus === "connected" ? "connected"
    : `error: ${serverError ?? "unknown"}`;

  const setupLabel = initLoading ? "loading..."
    : initError ? `error: ${initError}`
    : setupStatus?.isReady ? "ready"
    : `incomplete (${setupStatus?.missing.join(", ") ?? "unknown"})`;

  const setupVariant = initLoading ? "info"
    : initError ? "error"
    : setupStatus?.isReady ? "success"
    : "warning";

  const contextLabel = contextStatus === "loading" ? "loading..."
    : contextStatus === "ready" ? "ready"
    : contextStatus === "missing" ? "missing"
    : `error: ${contextError ?? "unknown"}`;

  const contextVariant = contextStatus === "ready" ? "success"
    : contextStatus === "missing" ? "warning"
    : contextStatus === "loading" ? "info"
    : "error";

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box width={Math.min(columns, 60)} flexDirection="column">
        <Panel>
          <Panel.Content>
            <Box flexDirection="column" gap={1}>
              <SectionHeader>Diagnostics</SectionHeader>
              <KeyValue
                label="Server"
                value={
                  <Badge variant={serverBadgeVariant} dot>
                    {serverLabel}
                  </Badge>
                }
                labelWidth={14}
              />
              <KeyValue
                label="Setup"
                value={
                  <Badge variant={setupVariant} dot>
                    {setupLabel}
                  </Badge>
                }
                labelWidth={14}
              />
              <KeyValue
                label="Context"
                value={
                  <Badge variant={contextVariant} dot>
                    {contextLabel}
                  </Badge>
                }
                labelWidth={14}
              />
              {contextStatus === "ready" && contextGeneratedAt && (
                <KeyValue label="Generated at" value={formatTimestampOrNA(contextGeneratedAt)} labelWidth={14} />
              )}
              <KeyValue label="Node version" value={nodeVersion} labelWidth={14} />
              <Box gap={1} marginTop={1}>
                <Button variant="secondary" onPress={handleRefreshAll} isActive={isButtonActive(0)}>
                  Refresh Diagnostics
                </Button>
                <Button
                  variant="primary"
                  onPress={handleRegenerateContext}
                  disabled={contextActionDisabled}
                  isActive={isButtonActive(1)}
                >
                  {contextActionLabel}
                </Button>
              </Box>
              {isRefreshing && (
                <Spinner label="Regenerating context snapshot..." />
              )}
              {contextError && <Text color="red">{contextError}</Text>}
            </Box>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
