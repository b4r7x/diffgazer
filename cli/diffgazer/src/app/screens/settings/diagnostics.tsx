import { useDiagnosticsData } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { formatTimestampOrNA } from "@diffgazer/core/format";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { KeyValue } from "../../../components/ui/key-value";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import {
  deriveDiagnosticsActions,
  triggerDiagnosticsRefreshAll,
} from "../../../features/settings/diagnostics/derive-actions";
import {
  getContextLabel,
  getContextVariant,
  getServerBadgeVariant,
  getServerLabel,
  getSetupLabel,
  getSetupVariant,
} from "../../../features/settings/diagnostics/derive-display";
import { useSettingsZone } from "../../../features/settings/hooks/use-settings-zone";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useScope } from "../../../hooks/use-scope";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";

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
    initialZone: "buttons",
  });

  usePageFooter({
    shortcuts: [
      { key: "←/→", label: "Move Action" },
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

  const setupInput = { isLoading: initLoading, error: initError, setupStatus };
  const serverBadgeVariant = getServerBadgeVariant(serverStatus);
  const serverLabel = getServerLabel(serverStatus, serverError);
  const setupLabel = getSetupLabel(setupInput);
  const setupVariant = getSetupVariant(setupInput);
  const contextLabel = getContextLabel(contextStatus, contextError);
  const contextVariant = getContextVariant(contextStatus);

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
                <KeyValue
                  label="Generated at"
                  value={formatTimestampOrNA(contextGeneratedAt)}
                  labelWidth={14}
                />
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
              {isRefreshing && <Spinner label="Regenerating context snapshot..." />}
              {contextError && <Text color="red">{contextError}</Text>}
            </Box>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
