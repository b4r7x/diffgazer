import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { LensId } from "@diffgazer/core/schemas/review";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "@diffgazer/core/footer";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useNavigation } from "../../navigation-context.js";
import { useSettingsZone } from "../../../hooks/use-settings-zone.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { useSettings, useSaveSettings, guardQueryState } from "@diffgazer/core/api/hooks";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Button } from "../../../components/ui/button.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { AnalysisSelector, lensOptions } from "../../../features/settings/components/analysis-selector.js";
import { isLensSelectionDirty, resolveEffectiveLenses } from "../../../features/settings/lens-selection.js";

const LIST_SHORTCUTS = [
  { key: "Esc", label: "Back" },
  { key: "Tab", label: "Switch zone" },
  { key: "↑↓", label: "Navigate" },
  { key: "Space", label: "Toggle Lens" },
] as const;

const BUTTON_SHORTCUTS = [
  { key: "Esc", label: "Back" },
  { key: "Tab", label: "Switch zone" },
  { key: "←→", label: "Move Action" },
  { key: "Enter", label: "Activate" },
] as const;

function isLensId(value: string): value is LensId {
  return lensOptions.some((lens) => lens.id === value);
}

export function AnalysisScreen(): ReactElement {
  const { columns } = useTerminalDimensions();
  useScope("settings-analysis");
  useBackHandler();

  const { goBack } = useNavigation();
  const settingsQuery = useSettings();
  const saveSettings = useSaveSettings();
  const [selectedLenses, setSelectedLenses] = useState<LensId[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSaving = saveSettings.isPending;
  const persistedLenses = (settingsQuery.data?.defaultLenses ?? []).filter(isLensId);
  const fallbackLenses = lensOptions.map((lens) => lens.id);
  const currentLenses = persistedLenses.length > 0 ? persistedLenses : fallbackLenses;
  const effectiveLenses = resolveEffectiveLenses(persistedLenses, selectedLenses, fallbackLenses);
  const hasLensSelection = effectiveLenses.length > 0;
  const isDirty = isLensSelectionDirty(currentLenses, selectedLenses);
  const canSave = !isSaving && isDirty && hasLensSelection;

  const { isListActive, isButtonActive, zone } = useSettingsZone({
    buttonCount: 2,
    disabled: isSaving,
  });

  usePageFooter({
    shortcuts: zone === "buttons" ? [...BUTTON_SHORTCUTS] : [...LIST_SHORTCUTS],
  });

  function handleSave() {
    if (!canSave) return;
    setError(null);
    saveSettings.mutate(
      { defaultLenses: effectiveLenses },
      {
        onSuccess: () => {
          setSelectedLenses(null);
          goBack();
        },
        onError: (err) => {
          setError(err.message);
        },
      },
    );
  }

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

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box width={Math.min(columns, 60)} flexDirection="column">
        <Panel>
          <Panel.Content>
            <Box flexDirection="column" gap={1}>
              <SectionHeader>Analysis Settings</SectionHeader>
              <Text dimColor>Choose which agents run during reviews.</Text>
              <AnalysisSelector
                selectedLenses={effectiveLenses}
                onChange={setSelectedLenses}
                isActive={isListActive}
                disabled={isSaving}
              />
              {!hasLensSelection && (
                <Text color="red">Select at least one agent.</Text>
              )}
              <Box gap={1}>
                <Button
                  variant="ghost"
                  onPress={goBack}
                  disabled={isSaving}
                  isActive={isButtonActive(0)}
                >
                  Cancel
                </Button>
                <Button
                  variant="success"
                  onPress={handleSave}
                  disabled={!canSave}
                  isActive={isButtonActive(1)}
                >
                  {isSaving ? "Saving..." : "Save"}
                </Button>
              </Box>
              {error && <Text color="red">{error}</Text>}
            </Box>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
