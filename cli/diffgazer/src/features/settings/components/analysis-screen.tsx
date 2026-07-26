import { useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { SETTINGS_SCREEN_COPY } from "@diffgazer/core/schemas/config";
import { NAVIGATE_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { deriveLensSelectionState, LENS_IDS, type LensId } from "@diffgazer/core/schemas/review";
import { Text } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { AnalysisSelector } from "../../../components/shared/analysis-selector";
import { useNavigation } from "../../../hooks/use-navigation";
import { useTheme } from "../../../theme/provider";
import { SettingsFormScreen } from "./settings-form-screen";

const LIST_SHORTCUTS: Shortcut[] = [NAVIGATE_SHORTCUT, { key: "Space", label: "Toggle Lens" }];

export function AnalysisScreen(): ReactElement {
  const { tokens } = useTheme();
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

  return (
    <SettingsFormScreen
      title={SETTINGS_SCREEN_COPY.analysis.title}
      subtitle={SETTINGS_SCREEN_COPY.analysis.subtitle}
      loadingLabel="Loading analysis settings..."
      listShortcuts={LIST_SHORTCUTS}
      saving={isSaving}
      canSave={canSave}
      error={error}
      onSave={handleSave}
    >
      {({ isListActive, enterButtons, isCompact }) => (
        <>
          <AnalysisSelector
            selectedLenses={effectiveLenses}
            onChange={setSelectedLenses}
            isActive={isListActive}
            disabled={isSaving}
            compact={isCompact}
            onDownBoundary={enterButtons}
          />
          {!hasLensSelection ? <Text color={tokens.error}>Select at least one lens.</Text> : null}
        </>
      )}
    </SettingsFormScreen>
  );
}
