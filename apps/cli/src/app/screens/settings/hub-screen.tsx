import type { ReactElement } from "react";
import { Box, Text } from "ink";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useInit } from "@diffgazer/api/hooks";
import { useSettings } from "@diffgazer/api/hooks";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { Menu } from "../../../components/ui/menu.js";
import { SETTINGS_MENU_ITEMS, SETTINGS_SHORTCUTS } from "../../../config/navigation.js";
import { useNavigation } from "../../navigation-context.js";
import type { Route } from "../../routes.js";
import type { SettingsAction } from "../../../config/navigation.js";
import { AVAILABLE_PROVIDERS } from "@diffgazer/schemas/config";

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
  const { data: initData, isLoading: initLoading, error: initError } = useInit();
  const { data: settings, isLoading: settingsLoading, error: settingsError } = useSettings();

  const isLoading = initLoading || settingsLoading;
  const error = initError?.message ?? settingsError?.message ?? null;

  const onSelect = (id: string) => {
    const screen = SETTINGS_ROUTE_MAP[id];
    if (screen) {
      navigate({ screen } as Route);
    }
  };

  const descriptions = isLoading ? null : buildDescriptions(initData, settings);

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Settings</SectionHeader>
          {error && <Text color="red">{error}</Text>}
          {isLoading ? (
            <Spinner label="Loading settings..." />
          ) : (
            <Menu variant="hub" onSelect={onSelect}>
              {SETTINGS_MENU_ITEMS.map((item, index) => (
                <Menu.Item
                  key={item.id}
                  id={item.id}
                  hotkey={index + 1}
                  value={descriptions?.[item.id] ?? item.description}
                >
                  {item.label}
                </Menu.Item>
              ))}
            </Menu>
          )}
        </Box>
      </Panel.Content>
    </Panel>
  );
}
