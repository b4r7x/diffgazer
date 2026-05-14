import { useState } from "react";
import type { ReactElement } from "react";
import { Box, Text } from "ink";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import { useScope } from "../../../hooks/use-scope.js";
import { usePageFooter } from "@diffgazer/core/footer";
import { useBackHandler } from "../../../hooks/use-back-handler.js";
import { useSettingsZone } from "../../../hooks/use-settings-zone.js";
import { useTerminalDimensions } from "../../../hooks/use-terminal-dimensions.js";
import { useNavigation } from "../../navigation-context.js";
import { useSettings, useSaveSettings, guardQueryState } from "@diffgazer/core/api/hooks";
import { Panel } from "../../../components/ui/panel.js";
import { SectionHeader } from "../../../components/ui/section-header.js";
import { Spinner } from "../../../components/ui/spinner.js";
import { Button } from "../../../components/ui/button.js";
import { Callout } from "../../../components/ui/callout.js";
import { StorageSelector } from "../../../features/settings/components/storage-selector.js";
import { deriveStorageSaveState } from "../../../features/settings/storage/derive-save-state.js";

export function StorageScreen(): ReactElement {
  const { columns } = useTerminalDimensions();
  const { goBack } = useNavigation();
  useScope("settings-storage");
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
  });

  usePageFooter({
    shortcuts: [
      { key: "Tab", label: "Switch zone" },
      { key: "↑↓", label: "Navigate" },
      { key: "Enter", label: "Select" },
    ],
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  });

  function handleSave() {
    if (!canSave) return;
    setSaveError(null);
    saveSettings.mutate({ secretsStorage: effectiveStorage }, {
      onSuccess: () => {
        goBack();
      },
      onError: (err) => {
        setSaveError(err instanceof Error ? err.message : "Failed to save settings");
      },
    });
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
              <Text dimColor>
                Choose where API keys and sensitive data should be stored.
              </Text>
              <StorageSelector
                value={effectiveStorage}
                onChange={(v) => setStorage(v as SecretsStorage)}
                isActive={isListActive}
              />
              <Callout variant="info">
                <Text>Changes will take effect immediately after saving.</Text>
              </Callout>
              <Box gap={1}>
                <Button variant="secondary" onPress={goBack} disabled={saving} isActive={isButtonActive(0)}>
                  Cancel
                </Button>
                <Button variant="primary" onPress={handleSave} disabled={!canSave} isActive={isButtonActive(1)}>
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
