import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "@diffgazer/core/footer";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { useInit, useSettings, guardQueryState } from "@diffgazer/core/api/hooks";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { Menu } from "../../../components/ui/menu.js";
import { SETTINGS_MENU_ITEMS, type SettingsAction } from "@diffgazer/core/schemas/ui";
import { SETTINGS_SHORTCUTS } from "../../../config/navigation.js";
import { useNavigation } from "../../navigation-context.js";
import type { Route } from "../../routes.js";
import { buildHubValues } from "./hub-screen-values.js";

const SETTINGS_ROUTE_MAP: Record<SettingsAction, Route["screen"]> = {
  "trust": "settings/trust-permissions",
  "theme": "settings/theme",
  "provider": "settings/providers",
  "storage": "settings/storage",
  "agent-execution": "settings/agent-execution",
  "analysis": "settings/analysis",
  "diagnostics": "settings/diagnostics",
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

  const values = buildHubValues(initQuery.data, settingsQuery.data);
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
                  <Menu.Item
                    key={item.id}
                    id={item.id}
                    value={values[item.id]}
                  >
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
