import type { ReactElement } from "react";
import { Box } from "ink";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Menu } from "../../../components/ui/menu.js";
import { SETTINGS_MENU_ITEMS, SETTINGS_SHORTCUTS } from "../../../config/navigation.js";
import { useNavigation } from "../../navigation-context.js";
import type { Route } from "../../routes.js";

const SETTINGS_ROUTE_MAP: Record<string, Route["screen"]> = {
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

  const onSelect = (id: string) => {
    const screen = SETTINGS_ROUTE_MAP[id];
    if (screen) {
      navigate({ screen } as Route);
    }
  };

  return (
    <Panel>
      <Panel.Content>
        <Box flexDirection="column" gap={1}>
          <SectionHeader>Settings</SectionHeader>
          <Menu variant="hub" onSelect={onSelect}>
            {SETTINGS_MENU_ITEMS.map((item, index) => (
              <Menu.Item
                key={item.id}
                id={item.id}
                hotkey={index + 1}
                value={item.description}
              >
                {item.label}
              </Menu.Item>
            ))}
          </Menu>
        </Box>
      </Panel.Content>
    </Panel>
  );
}
