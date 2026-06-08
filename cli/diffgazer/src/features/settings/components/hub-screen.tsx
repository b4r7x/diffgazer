import { guardQueryState, useInit, useSettings } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { buildHubValues } from "@diffgazer/core/schemas/config";
import {
  SETTINGS_MENU_ITEMS,
  SETTINGS_SHORTCUTS,
  type SettingsAction,
} from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Menu } from "../../../components/ui/menu";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { useScope } from "../../../hooks/use-scope";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import type { Route } from "../../../lib/routes.js";

const SETTINGS_ROUTE_MAP: Record<SettingsAction, Route["screen"]> = {
  trust: "settings/trust-permissions",
  theme: "settings/theme",
  provider: "settings/providers",
  storage: "settings/storage",
  "agent-execution": "settings/agent-execution",
  analysis: "settings/analysis",
  diagnostics: "settings/diagnostics",
};

export function SettingsHubScreen(): ReactElement {
  useScope("settings-hub");
  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });
  useBackHandler();

  const { navigate } = useNavigation();
  const { columns } = useTerminalDimensions();
  const initQuery = useInit();
  const settingsQuery = useSettings();

  const onSelect = (id: string) => {
    const screen = SETTINGS_ROUTE_MAP[id as SettingsAction];
    if (screen) {
      navigate({ screen } as Route);
    }
  };

  const guard = guardQueryState(initQuery, {
    loading: () => (
      <Box justifyContent="center" alignItems="center" flexGrow={1}>
        <Box width={Math.min(columns, 70)}>
          <Panel>
            <Panel.Content>
              <Box flexDirection="column" gap={1}>
                <SectionHeader>Settings Hub</SectionHeader>
                <Spinner label="Loading settings..." />
              </Box>
            </Panel.Content>
          </Panel>
        </Box>
      </Box>
    ),
    error: (err) => (
      <Box justifyContent="center" alignItems="center" flexGrow={1}>
        <Box width={Math.min(columns, 70)}>
          <Panel>
            <Panel.Content>
              <Box flexDirection="column" gap={1}>
                <SectionHeader>Settings Hub</SectionHeader>
                <Text color="red">Error: {err.message}</Text>
              </Box>
            </Panel.Content>
          </Panel>
        </Box>
      </Box>
    ),
  });
  if (guard) return guard;

  if (settingsQuery.isLoading) {
    return (
      <Box justifyContent="center" alignItems="center" flexGrow={1}>
        <Box width={Math.min(columns, 70)}>
          <Panel>
            <Panel.Content>
              <Box flexDirection="column" gap={1}>
                <SectionHeader>Settings Hub</SectionHeader>
                <Spinner label="Loading settings..." />
              </Box>
            </Panel.Content>
          </Panel>
        </Box>
      </Box>
    );
  }

  const values = buildHubValues({
    provider: initQuery.data?.config?.provider,
    isConfigured: initQuery.data?.setup?.isConfigured ?? false,
    isTrusted: Boolean(initQuery.data?.project.trust?.capabilities.readFiles),
    theme: settingsQuery.data?.theme,
    secretsStorage: settingsQuery.data?.secretsStorage,
    agentExecution: settingsQuery.data?.agentExecution,
    selectedLensCount: settingsQuery.data?.defaultLenses?.length,
  });
  const settingsError = settingsQuery.error?.message ?? null;

  return (
    <Box justifyContent="center" alignItems="center" flexGrow={1}>
      <Box width={Math.min(columns, 70)} flexDirection="column">
        <Panel>
          <Panel.Content>
            <Box flexDirection="column" gap={1}>
              <SectionHeader>Settings Hub</SectionHeader>
              <Menu variant="hub" onSelect={onSelect}>
                {SETTINGS_MENU_ITEMS.map((item) => (
                  <Menu.Item key={item.id} id={item.id} value={values[item.id]}>
                    {item.label}
                  </Menu.Item>
                ))}
              </Menu>
            </Box>
          </Panel.Content>
        </Panel>
        <Box marginTop={1} gap={2}>
          <Text dimColor>config path: ~/.diffgazer/config.json</Text>
          <Text dimColor>|</Text>
          <Text color={settingsError ? "red" : undefined} dimColor={!settingsError}>
            {settingsError ?? "local settings"}
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
