import {
  deriveDiagnosticsActions,
  getContextActionLabel,
  getContextPresentation,
  getServerStatusPresentation,
  getSetupPresentation,
  refreshAllDiagnostics,
  useDiagnosticsData,
} from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { formatTimestampOrNA } from "@diffgazer/core/format";
import { BACK_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import { type ReactElement, useState } from "react";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { KeyValue } from "../../../components/ui/key-value";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { useSettingsZone } from "../hooks/use-settings-zone";

export function DiagnosticsScreen(): ReactElement {
  const { columns } = useTerminalDimensions();
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

  const [isRefreshingAll, setIsRefreshingAll] = useState(false);

  const { isButtonActive } = useSettingsZone({
    buttonCount: 2,
    disabled: isRefreshing,
    initialZone: "buttons",
    hasList: false,
  });

  usePageFooter({
    shortcuts: [
      { key: "←/→", label: "Move Action" },
      { key: "Enter", label: "Activate" },
    ],
    rightShortcuts: [BACK_SHORTCUT],
  });

  const { refreshAllDisabled, contextActionDisabled } = deriveDiagnosticsActions({
    canRegenerate,
    isRefreshing,
    isRefreshingAll,
  });

  const handleRefreshAll = () => {
    if (refreshAllDisabled) return;
    setIsRefreshingAll(true);
    void refreshAllDiagnostics({ retryServer, refetchContext }).finally(() => {
      setIsRefreshingAll(false);
    });
  };

  const contextActionLabel = getContextActionLabel(isRefreshing, contextStatus);
  const nodeVersion = process.version;

  const server = getServerStatusPresentation(serverState);
  const setup = getSetupPresentation({ isLoading: initLoading, error: initError, setupStatus });
  const context = getContextPresentation(contextStatus, contextError);

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
                  <Badge variant={server.variant} dot>
                    {server.label}
                  </Badge>
                }
                labelWidth={14}
              />
              <KeyValue
                label="Setup"
                value={
                  <Badge variant={setup.variant} dot>
                    {setup.label}
                  </Badge>
                }
                labelWidth={14}
              />
              <KeyValue
                label="Context"
                value={
                  <Badge variant={context.variant} dot>
                    {context.label}
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
                <Button
                  variant="secondary"
                  onPress={handleRefreshAll}
                  disabled={refreshAllDisabled}
                  isActive={isButtonActive(0)}
                >
                  {isRefreshingAll ? "Refreshing..." : "Refresh Diagnostics"}
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
