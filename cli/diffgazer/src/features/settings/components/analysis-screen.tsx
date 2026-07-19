import { guardQueryState, useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { usePageFooter } from "@diffgazer/core/footer";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import { NAVIGATE_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import {
  ANALYSIS_SETTINGS_SUBTITLE,
  deriveLensSelectionState,
  LENS_IDS,
  type LensId,
} from "@diffgazer/core/schemas/review";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { AnalysisSelector } from "../../../components/shared/analysis-selector";
import { useQueryGuardPanels } from "../../../components/shared/query-guard-panels";
import { Button } from "../../../components/ui/button";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { getSettingsFooter, useSettingsZone } from "../hooks/use-settings-zone";

const LIST_SHORTCUTS: Shortcut[] = [NAVIGATE_SHORTCUT, { key: "Space", label: "Toggle Lens" }];

export function AnalysisScreen(): ReactElement {
  const { columns, rows } = useTerminalDimensions();
  const { tokens } = useTheme();
  useBackHandler();

  const { goBack } = useNavigation();
  const settingsQuery = useSettings();
  const saveSettings = useSaveSettings();
  const [selectedLenses, setSelectedLenses] = useState<LensId[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isSaving = saveSettings.isPending;
  const fallbackLenses = [...LENS_IDS];
  const {
    effective: effectiveLenses,
    isDirty,
    hasSelection: hasLensSelection,
  } = deriveLensSelectionState(
    settingsQuery.data?.defaultLenses ?? [],
    selectedLenses,
    fallbackLenses,
  );
  const canSave = !isSaving && isDirty && hasLensSelection;

  const { isListActive, isButtonActive, zone, enterButtons } = useSettingsZone({
    buttonCount: 2,
    disabled: isSaving,
    disabledButtons: canSave ? undefined : [1],
  });

  usePageFooter(
    getSettingsFooter({
      zone,
      listShortcuts: LIST_SHORTCUTS,
      buttonActionLabel: isButtonActive(0) ? "Cancel" : "Save",
      buttonActionDisabled: isButtonActive(1) && !canSave,
    }),
  );

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

  const queryGuardPanels = useQueryGuardPanels("Loading analysis settings...");
  const guard = guardQueryState(settingsQuery, queryGuardPanels);

  if (guard) return guard;

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box width={Math.min(columns, 60)} flexDirection="column">
        <Panel>
          <Panel.Content>
            <Box flexDirection="column" gap={rows <= 24 ? 0 : 1}>
              <SectionHeader>Analysis Settings</SectionHeader>
              <Text dimColor>{ANALYSIS_SETTINGS_SUBTITLE}</Text>
              <AnalysisSelector
                selectedLenses={effectiveLenses}
                onChange={setSelectedLenses}
                isActive={isListActive}
                disabled={isSaving}
                compact={rows <= 24}
                onDownBoundary={enterButtons}
              />
              {!hasLensSelection ? (
                <Text color={tokens.error}>Select at least one lens.</Text>
              ) : null}
              {error ? <Text color={tokens.error}>{sanitizeTerminalText(error)}</Text> : null}
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
            </Box>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
