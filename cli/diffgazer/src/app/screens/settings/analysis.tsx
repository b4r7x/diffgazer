import { guardQueryState, useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import type { LensId } from "@diffgazer/core/schemas/review";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { AnalysisSelector, lensOptions } from "../../../components/shared/analysis-selector";
import { Button } from "../../../components/ui/button";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useSettingsZone } from "../../../features/settings/hooks/use-settings-zone";
import {
  isLensSelectionDirty,
  resolveEffectiveLenses,
} from "../../../features/settings/lens-selection";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useScope } from "../../../hooks/use-scope";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { useNavigation } from "../../providers/navigation-provider";

const LIST_SHORTCUTS = [
  { key: "Esc", label: "Back" },
  { key: "Tab", label: "Switch Zone" },
  { key: "↑/↓", label: "Navigate" },
  { key: "Space", label: "Toggle Lens" },
] as const;

const BUTTON_SHORTCUTS = [
  { key: "Esc", label: "Back" },
  { key: "Tab", label: "Switch Zone" },
  { key: "←/→", label: "Move Action" },
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
              {!hasLensSelection && <Text color="red">Select at least one agent.</Text>}
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
