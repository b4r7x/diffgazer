import type { ReactElement } from "react";
import { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import {
  SETTINGS_MENU_ITEMS,
  type SettingsAction,
  type SettingsSection,
} from "@repo/core";
import { Menu, MenuItem } from "../../components/ui/menu.js";
import { Panel, PanelHeader } from "../../components/ui/panel.js";
import { Badge } from "../../components/ui/badge.js";
import { useSettingsState } from "../../features/settings/hooks/use-settings-state.js";
import { useTerminalDimensions } from "../../hooks/use-terminal-dimensions.js";

export const SETTINGS_HUB_FOOTER_SHORTCUTS = [
  { key: "1-4", label: "jump" },
  { key: "j/k", label: "navigate" },
  { key: "Enter", label: "select" },
  { key: "Esc", label: "back" },
];

interface SettingsHubViewProps {
  projectId: string;
  onNavigate: (section: SettingsSection) => void;
  onBack: () => void;
  isActive?: boolean;
}

type ValueVariant = "default" | "success" | "success-badge" | "muted";

interface ItemValue {
  value: string;
  variant: ValueVariant;
}

function getValueForItem(
  id: SettingsAction,
  state: ReturnType<typeof useSettingsState>
): ItemValue {
  switch (id) {
    case "trust":
      return state.isTrusted
        ? { value: "Trusted", variant: "success-badge" }
        : { value: "Not trusted", variant: "muted" };
    case "theme":
      return {
        value: (state.settings?.theme ?? "DARK").toUpperCase(),
        variant: "default",
      };
    case "provider":
      return state.activeProvider
        ? { value: state.activeProvider, variant: "success" }
        : { value: "Not configured", variant: "muted" };
    case "diagnostics":
      return { value: "v2.1.0", variant: "muted" };
    default:
      return { value: "", variant: "default" };
  }
}

function getMenuItem(id: SettingsAction) {
  return SETTINGS_MENU_ITEMS.find((i) => i.id === id)!;
}

function formatLastSync(lastSyncTime: Date | null): string {
  if (!lastSyncTime) return "never";

  const diffMs = Date.now() - lastSyncTime.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMin / 60);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return "1d+ ago";
}

interface SettingsMenuItemProps {
  id: SettingsAction;
  hotkey: number;
  state: ReturnType<typeof useSettingsState>;
}

function SettingsMenuItem({ id, hotkey, state }: SettingsMenuItemProps): ReactElement {
  const item = getMenuItem(id);
  const { value, variant } = getValueForItem(id, state);

  const displayValue =
    variant === "success-badge" ? <Badge text={value} variant="success" /> : value;
  const displayVariant = variant === "success-badge" ? "success" : variant;

  return (
    <MenuItem
      id={item.id}
      hotkey={hotkey}
      value={displayValue}
      valueVariant={displayVariant as "default" | "success" | "muted"}
    >
      {item.label}
    </MenuItem>
  );
}

export function SettingsHubView({
  projectId,
  onNavigate,
  onBack,
  isActive = true,
}: SettingsHubViewProps): ReactElement {
  const { columns } = useTerminalDimensions();
  const panelWidth = Math.min(76, columns - 4);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const settingsState = useSettingsState(projectId);

  useEffect(() => {
    void settingsState.loadAll().then(() => setLastSync(new Date()));
  }, []);

  useInput(
    (input, key) => {
      if (key.escape || input === "b") {
        onBack();
      }
    },
    { isActive }
  );

  function handleActivate(item: { id: string }): void {
    const section = item.id as SettingsAction;
    onNavigate(section === "provider" ? "providers" : section);
  }

  return (
    <Box flexDirection="column" padding={1} alignItems="center" justifyContent="center">
      <Box flexDirection="column" width={panelWidth}>
        <Panel>
          <PanelHeader variant="floating">SETTINGS HUB</PanelHeader>

          <Menu
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onActivate={handleActivate}
            isActive={isActive}
            enableNumberJump
            variant="hub"
            width={panelWidth - 2}
          >
            <SettingsMenuItem id="trust" hotkey={1} state={settingsState} />
            <SettingsMenuItem id="theme" hotkey={2} state={settingsState} />
            <SettingsMenuItem id="provider" hotkey={3} state={settingsState} />
            <SettingsMenuItem id="diagnostics" hotkey={4} state={settingsState} />
          </Menu>
        </Panel>

        <Box marginTop={1} justifyContent="center" gap={1}>
          <Text dimColor>config path: ~/.config/stargazer/settings.json</Text>
          <Text dimColor>|</Text>
          <Text dimColor>last sync: {formatLastSync(lastSync)}</Text>
        </Box>
      </Box>

    </Box>
  );
}
