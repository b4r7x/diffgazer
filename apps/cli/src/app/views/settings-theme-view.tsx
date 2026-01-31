import type { ReactElement } from "react";
import { useEffect } from "react";
import { Box, useStdout } from "ink";
import type { Theme } from "@repo/schemas/settings";
import { ThemeStep } from "../../components/wizard/theme-step.js";
import { Panel, PanelHeader } from "../../components/ui/layout/index.js";
import { useSettingsState } from "../../features/settings/hooks/use-settings-state.js";
import type { Shortcut } from "../../components/ui/branding/footer-bar.js";

export const SETTINGS_THEME_FOOTER_SHORTCUTS: Shortcut[] = [
  { key: "Up/Down", label: "Navigate" },
  { key: "Enter", label: "Select" },
  { key: "b", label: "Back" },
];

interface SettingsThemeViewProps {
  projectId: string;
  onBack: () => void;
  isActive?: boolean;
}

export function SettingsThemeView({
  projectId,
  onBack,
  isActive = true,
}: SettingsThemeViewProps): ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const panelWidth = Math.min(70, terminalWidth - 4);

  const settingsState = useSettingsState(projectId);

  useEffect(() => {
    void settingsState.loadAll();
  }, []);

  async function handleSubmit(theme: Theme): Promise<void> {
    await settingsState.saveTheme(theme);
    onBack();
  }

  const currentTheme = settingsState.settings?.theme ?? "auto";

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="center">
        <Box width={panelWidth}>
          <Panel>
            <PanelHeader variant="floating">THEME</PanelHeader>
            <Box marginTop={1}>
              <ThemeStep
                mode="settings"
                currentStep={1}
                totalSteps={1}
                initialTheme={currentTheme}
                onSubmit={handleSubmit}
                onBack={onBack}
                isActive={isActive}
              />
            </Box>
          </Panel>
        </Box>
      </Box>
    </Box>
  );
}
