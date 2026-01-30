import type { ReactElement } from "react";
import { useEffect } from "react";
import { Box, useStdout } from "ink";
import type { Theme } from "@repo/schemas/settings";
import { ThemeStep } from "../../components/wizard/theme-step.js";
import { Panel, PanelHeader } from "../../components/ui/panel.js";
import { useSettingsState } from "../../features/settings/hooks/use-settings-state.js";

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

  const handleSubmit = async (theme: Theme) => {
    await settingsState.saveTheme(theme);
    onBack();
  };

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
