import { guardQueryState, useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { usePageFooter } from "@diffgazer/core/footer";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import { NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { useQueryGuardPanels } from "../../../components/shared/query-guard-panels";
import { StorageSelector } from "../../../components/shared/storage-selector";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { useTheme } from "../../../theme/provider";
import { getSettingsFooter, useSettingsZone } from "../hooks/use-settings-zone";
import { deriveStorageSaveState } from "../lib/derive-storage-save-state";

export function StorageScreen(): ReactElement {
  const { columns, rows } = useTerminalDimensions();
  const { tokens } = useTheme();
  const { goBack } = useNavigation();
  useBackHandler();

  const settingsQuery = useSettings();
  const saveSettings = useSaveSettings();
  const [storage, setStorage] = useState<SecretsStorage | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const saving = saveSettings.isPending;
  const persistedStorage = settingsQuery.data?.secretsStorage ?? null;
  const { effective: effectiveStorage, canSave } = deriveStorageSaveState({
    persisted: persistedStorage,
    choice: storage,
    saving,
  });

  const { isListActive, isButtonActive, zone, enterButtons } = useSettingsZone({
    buttonCount: 2,
    disabled: saving,
    disabledButtons: canSave ? undefined : [1],
  });

  usePageFooter(
    getSettingsFooter({
      zone,
      listShortcuts: [NAVIGATE_SHORTCUT, { key: "Enter", label: "Select Storage" }],
      buttonActionLabel: isButtonActive(0) ? "Cancel" : "Save",
      buttonActionDisabled: isButtonActive(1) && !canSave,
    }),
  );

  function handleSave() {
    if (!canSave || !effectiveStorage) return;
    setSaveError(null);
    saveSettings.mutate(
      { secretsStorage: effectiveStorage },
      {
        onSuccess: () => {
          goBack();
        },
        onError: (err) => {
          setSaveError(getErrorMessage(err, "Failed to save settings"));
        },
      },
    );
  }

  const queryGuardPanels = useQueryGuardPanels("Loading storage settings...");
  const guard = guardQueryState(settingsQuery, queryGuardPanels);

  if (guard) return guard;

  return (
    <Box justifyContent="center" flexGrow={1}>
      <Box width={Math.min(columns, 60)} flexDirection="column">
        <Panel>
          <Panel.Content>
            <Box flexDirection="column" gap={rows <= 24 ? 0 : 1}>
              <SectionHeader>Configure Secrets Storage</SectionHeader>
              <Text dimColor>Choose where API keys and sensitive data should be stored.</Text>
              <StorageSelector
                value={effectiveStorage}
                onChange={setStorage}
                isActive={isListActive}
                onDownBoundary={enterButtons}
              />
              {rows <= 24 ? (
                <Text color={tokens.info}>Changes take effect after saving.</Text>
              ) : (
                <Callout variant="info">
                  <Text>Changes will take effect immediately after saving.</Text>
                </Callout>
              )}
              {saveError ? (
                <Text color={tokens.error}>{sanitizeTerminalText(saveError)}</Text>
              ) : null}
              <Box gap={1}>
                <Button
                  variant="secondary"
                  onPress={goBack}
                  disabled={saving}
                  isActive={isButtonActive(0)}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onPress={handleSave}
                  disabled={!canSave}
                  isActive={isButtonActive(1) && canSave}
                >
                  {saving ? "Saving..." : "Save"}
                </Button>
              </Box>
            </Box>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
