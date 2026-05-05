import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { useInit, useSettings, guardQueryState } from "@diffgazer/core/api/hooks";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { Menu } from "../../../components/ui/menu.js";
import { SETTINGS_MENU_ITEMS, SETTINGS_SHORTCUTS } from "../../../config/navigation.js";
import { useNavigation } from "../../navigation-context.js";
import type { Route } from "../../routes.js";
import type { SettingsAction } from "../../../config/navigation.js";
import { AVAILABLE_PROVIDERS } from "@diffgazer/core/schemas/config";

const SETTINGS_ROUTE_MAP: Record<string, Route["screen"]> = {
  "trust": "settings/trust-permissions",
  "theme": "settings/theme",
  "provider": "settings/providers",
  "storage": "settings/storage",
  "agent-execution": "settings/agent-execution",
  "analysis": "settings/analysis",
  "diagnostics": "settings/diagnostics",
};

function getProviderDisplayName(providerId: string): string {
  const provider = AVAILABLE_PROVIDERS.find((p) => p.id === providerId);
  return provider?.name ?? providerId;
}

function buildDescriptions(
  init: ReturnType<typeof useInit>["data"],
  settings: ReturnType<typeof useSettings>["data"],
): Record<SettingsAction, string> {
  const trust = init?.project.trust;
  const trustStatus = trust ? `Trusted (${trust.trustMode})` : "Not trusted";

  const activeProvider = init?.config
    ? getProviderDisplayName(init.config.provider)
    : "Not configured";

  const theme = settings?.theme ?? "auto";
  const storage = settings?.secretsStorage ?? "not set";
  const execution = settings?.agentExecution ?? "parallel";
  const lensCount = settings?.defaultLenses.length ?? 0;

  return {
    trust: trustStatus,
    theme: `Current: ${theme}`,
    provider: activeProvider,
    storage: `Current: ${storage}`,
    "agent-execution": `Mode: ${execution}`,
    analysis: `${lensCount} lens${lensCount === 1 ? "" : "es"} active`,
    diagnostics: "Run system health checks",
  };
}

export function SettingsHubScreen(): ReactElement {
  useScope("settings-hub");
  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });
  useBackHandler();

  const { navigate } = useNavigation();
  const { columns } = useTerminalDimensions();
  const initQuery = useInit();
  const settingsQuery = useSettings();

  const onSelect = (id: string) => {
    const screen = SETTINGS_ROUTE_MAP[id];
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
                <SectionHeader>Settings</SectionHeader>
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
                <SectionHeader>Settings</SectionHeader>
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
                <SectionHeader>Settings</SectionHeader>
                <Spinner label="Loading settings..." />
              </Box>
            </Panel.Content>
          </Panel>
        </Box>
      </Box>
    );
  }

  const descriptions = buildDescriptions(initQuery.data, settingsQuery.data);

  return (
    <Box justifyContent="center" alignItems="center" flexGrow={1}>
      <Box width={Math.min(columns, 70)}>
        <Panel>
          <Panel.Content>
            <Box flexDirection="column" gap={1}>
              <SectionHeader>Settings</SectionHeader>
              {settingsQuery.error && <Text color="red">{settingsQuery.error.message}</Text>}
              <Menu variant="hub" onSelect={onSelect}>
                {SETTINGS_MENU_ITEMS.map((item, index) => (
                  <Menu.Item
                    key={item.id}
                    id={item.id}
                    hotkey={index + 1}
                    value={descriptions[item.id] ?? item.description}
                  >
                    {item.label}
                  </Menu.Item>
                ))}
              </Menu>
            </Box>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
