import type { ReactElement } from "react";
import { useEffect } from "react";
import { Box, useStdout } from "ink";
import { TrustStep } from "../../components/wizard/trust-step.js";
import { Panel, PanelHeader } from "../../components/ui/layout/index.js";
import { useSettingsState } from "../../features/settings/hooks/use-settings-state.js";

export const SETTINGS_TRUST_FOOTER_SHORTCUTS = [
  { key: "Space", label: "toggle" },
  { key: "t", label: "trust" },
  { key: "o", label: "once" },
  { key: "s", label: "skip" },
  { key: "b", label: "back" },
];

interface SettingsTrustViewProps {
  projectId: string;
  repoRoot: string;
  onBack: () => void;
  isActive?: boolean;
}

export function SettingsTrustView({
  projectId,
  repoRoot,
  onBack,
  isActive = true,
}: SettingsTrustViewProps): ReactElement {
  const { stdout } = useStdout();
  const terminalWidth = stdout?.columns ?? 80;
  const panelWidth = Math.min(70, terminalWidth - 4);

  const settingsState = useSettingsState(projectId);

  useEffect(() => {
    void settingsState.loadAll();
  }, []);

  async function handleComplete(
    trustConfig: Parameters<typeof settingsState.saveTrust>[0]
  ): Promise<void> {
    await settingsState.saveTrust(trustConfig);
    onBack();
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="center">
        <Box width={panelWidth}>
          <Panel>
            <PanelHeader variant="floating">TRUST & PERMISSIONS</PanelHeader>
            <Box marginTop={1}>
              <TrustStep
                mode="settings"
                currentStep={1}
                totalSteps={1}
                repoRoot={repoRoot}
                projectId={projectId}
                initialCapabilities={settingsState.trust?.capabilities}
                onComplete={handleComplete}
                onSkip={onBack}
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
