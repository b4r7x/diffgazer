import { guardQueryState, useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { usePageFooter } from "@diffgazer/core/footer";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import { BACK_SHORTCUT, NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { StorageSelector } from "../../../components/shared/storage-selector";
import { Button } from "../../../components/ui/button";
import { Callout } from "../../../components/ui/callout";
import { Panel } from "../../../components/ui/panel";
import { SectionHeader } from "../../../components/ui/section-header";
import { Spinner } from "../../../components/ui/spinner";
import { useBackHandler } from "../../../hooks/use-back-handler";
import { useNavigation } from "../../../hooks/use-navigation";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions";
import { useSettingsZone } from "../hooks/use-settings-zone.js";
import { deriveStorageSaveState } from "../lib/derive-storage-save-state.js";

export function StorageScreen(): ReactElement {
  const { columns } = useTerminalDimensions();
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

  const { isListActive, isButtonActive } = useSettingsZone({
    buttonCount: 2,
    disabled: saving,
    disabledButtons: canSave ? undefined : [1],
  });

  usePageFooter({
    shortcuts: [
      { key: "Tab", label: "Switch Zone" },
      NAVIGATE_SHORTCUT,
      { key: "Enter", label: "Select" },
    ],
    rightShortcuts: [BACK_SHORTCUT],
  });

  function handleSave() {
    if (!canSave) return;
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

  const guard = guardQueryState(settingsQuery, {
    loading: () => (
      <Panel>
        <Panel.Content>
          <Spinner label="Loading storage settings..." />
        </Panel.Content>
      </Panel>
    ),
    error: (err) => (
      <Panel>
        <Panel.Content>
          <Text color="red">Error: {err.message}</Text>
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
              <SectionHeader>Configure Secrets Storage</SectionHeader>
              <Text dimColor>Choose where API keys and sensitive data should be stored.</Text>
              <StorageSelector
                value={effectiveStorage}
                onChange={setStorage}
                isActive={isListActive}
              />
              <Callout variant="info">
                <Text>Changes will take effect immediately after saving.</Text>
              </Callout>
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
              {saveError && <Text color="red">{saveError}</Text>}
            </Box>
          </Panel.Content>
        </Panel>
      </Box>
    </Box>
  );
}
