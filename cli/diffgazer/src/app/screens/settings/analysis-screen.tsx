import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { LensId } from "@diffgazer/core/schemas/review";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "../../../hooks/use-page-footer.js";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useSettingsZone } from "../../../hooks/use-settings-zone.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { useSettings, useSaveSettings, guardQueryState } from "@diffgazer/core/api/hooks";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { AnalysisSelector, lensOptions } from "../../../features/settings/components/analysis-selector.js";

export function AnalysisScreen(): ReactElement {
  const { columns } = useTerminalDimensions();
  useScope("settings-analysis");
  usePageFooter({
    shortcuts: [
      { key: "Esc", label: "Back" },
      { key: "Tab", label: "Switch zone" },
      { key: "↑↓", label: "Navigate" },
      { key: "Space", label: "Toggle" },
    ],
  });
  useBackHandler();

  const settingsQuery = useSettings();
  const saveSettings = useSaveSettings();
  const [selectedLenses, setSelectedLenses] = useState<LensId[] | null>(null);
  const [saved, setSaved] = useState(false);

  const guard = guardQueryState(settingsQuery, {
    loading: () => (
      <Panel>
        <Panel.Content>
          <Spinner label="Loading analysis settings..." />
        </Panel.Content>
      </Panel>
    ),
    error: (err) => (
      <Panel>
        <Panel.Content>
          <Text color="red">{err.message}</Text>
        </Panel.Content>
      </Panel>
    ),
  });

  if (guard) return guard;

  const isSaving = saveSettings.isPending;
  const saveError = saveSettings.error?.message ?? null;
  const defaultLenses = settingsQuery.data?.defaultLenses ?? [];
  const fallbackLenses = lensOptions.map((l) => l.id);
  const currentLenses = defaultLenses.length > 0 ? defaultLenses : fallbackLenses;
  const effectiveLenses = selectedLenses ?? currentLenses;

  const { isListActive, isButtonActive } = useSettingsZone({
    buttonCount: 1,
    disabled: isSaving,
  });

  function handleSave() {
    if (effectiveLenses.length === 0) return;
    setSaved(false);
    saveSettings.mutate({ defaultLenses: effectiveLenses }, {
      onSuccess: () => setSaved(true),
    });
  }

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box width={Math.min(columns, 60)} flexDirection="column">
        <Panel>
          <Panel.Content>
            <Box flexDirection="column" gap={1}>
              <SectionHeader>Analysis Agents</SectionHeader>
              <Text dimColor>Select which agents run during review:</Text>
              <AnalysisSelector
                selectedLenses={effectiveLenses}
                onChange={setSelectedLenses}
                isActive={isListActive}
                disabled={isSaving}
              />
              {effectiveLenses.length === 0 && (
                <Text color="yellow">Select at least one agent.</Text>
              )}
              <Box gap={1}>
                <Button
                  variant="primary"
                  onPress={handleSave}
                  disabled={isSaving || effectiveLenses.length === 0}
                  isActive={isButtonActive(0)}
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </Box>
              {saved && <Text color="green">Analysis settings saved.</Text>}
              {saveError && <Text color="red">{saveError}</Text>}
            </Box>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
