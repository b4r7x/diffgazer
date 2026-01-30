import type { ReactElement } from "react";
import { useState, useEffect } from "react";
import { Box, Text, useInput, useStdout } from "ink";
import {
  SETTINGS_MENU_ITEMS,
  type SettingsAction,
  type SettingsSection,
} from "@repo/core";
import { Menu, MenuItem } from "../../components/ui/menu.js";
import { Panel, PanelHeader } from "../../components/ui/panel.js";
import { Badge } from "../../components/ui/badge.js";
import { FooterBarWithDivider } from "../../components/ui/footer-bar.js";
import { useTheme } from "../../hooks/use-theme.js";
import { useSettingsState } from "../../features/settings/hooks/use-settings-state.js";

const FOOTER_SHORTCUTS = [
  { key: "1-4", label: "jump" },
  { key: "j/k", label: "navigate" },
  { key: "Enter", label: "select" },
  { key: "Esc", label: "back" },
];

interface SettingsHubViewProps {
  projectId: string;
  repoRoot: string;
  onNavigate: (section: SettingsSection) => void;
  onBack: () => void;
  isActive?: boolean;
}

function getValueForItem(
  id: SettingsAction,
  state: ReturnType<typeof useSettingsState>
): { value: string; variant: "default" | "success" | "success-badge" | "muted" } {
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
      if (state.activeProvider) {
        return { value: state.activeProvider, variant: "success" };
      }
      return { value: "Not configured", variant: "muted" };
    case "diagnostics":
      return { value: "v2.1.0", variant: "muted" };
    default:
      return { value: "", variant: "default" };
  }
}

function formatLastSync(lastSyncTime: Date | null): string {
  if (!lastSyncTime) return "never";

  const now = new Date();
  const diffMs = now.getTime() - lastSyncTime.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return "1d+ ago";
}

export function SettingsHubView({
  projectId,
  repoRoot,
  onNavigate,
  onBack,
  isActive = true,
}: SettingsHubViewProps): ReactElement {
  const { colors } = useTheme();
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const panelWidth = Math.min(60, terminalWidth - 4);

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const settingsState = useSettingsState(projectId, repoRoot);

  useEffect(() => {
    void settingsState.loadAll().then(() => {
      setLastSync(new Date());
    });
  }, []);

  useInput(
    (input, key) => {
      if (key.escape || input === "b") {
        onBack();
      }
    },
    { isActive }
  );

  const handleActivate = (item: { id: string }) => {
    const section = item.id as SettingsAction;
    const navSection: SettingsSection =
      section === "provider" ? "providers" : section;
    onNavigate(navSection);
  };

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
          >
            {SETTINGS_MENU_ITEMS.map((item, idx) => {
              const { value, variant } = getValueForItem(item.id, settingsState);
              return (
                <MenuItem
                  key={item.id}
                  id={item.id}
                  hotkey={idx + 1}
                  value={
                    variant === "success-badge" ? (
                      <Badge text={value} variant="success" />
                    ) : (
                      value
                    )
                  }
                  valueVariant={variant === "success-badge" ? "success" : variant}
                >
                  {item.label}
                </MenuItem>
              );
            })}
          </Menu>
        </Panel>

        {/* Footer info like web */}
        <Box marginTop={1} justifyContent="center" gap={1}>
          <Text dimColor>config path: ~/.config/stargazer/settings.json</Text>
          <Text dimColor>|</Text>
          <Text dimColor>last sync: {formatLastSync(lastSync)}</Text>
        </Box>
      </Box>

      <Box marginTop={1}>
        <FooterBarWithDivider shortcuts={FOOTER_SHORTCUTS} />
      </Box>
    </Box>
  );
}
