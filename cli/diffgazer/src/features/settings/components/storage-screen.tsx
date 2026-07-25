import { useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import { NAVIGATE_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { Text } from "ink";
import type { ReactElement } from "react";
import { useState } from "react";
import { StorageSelector } from "../../../components/shared/storage-selector";
import { Callout } from "../../../components/ui/callout";
import { useNavigation } from "../../../hooks/use-navigation";
import { useTheme } from "../../../theme/provider";
import { deriveStorageSaveState } from "../lib/derive-storage-save-state";
import { SettingsFormScreen } from "./settings-form-screen";

const LIST_SHORTCUTS: Shortcut[] = [NAVIGATE_SHORTCUT, { key: "Enter", label: "Select Storage" }];

export function StorageScreen(): ReactElement {
  const { tokens } = useTheme();
  const { goBack } = useNavigation();

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

  return (
    <SettingsFormScreen
      title="Secrets Storage"
      subtitle="Choose where API keys and sensitive data should be stored."
      loadingLabel="Loading storage settings..."
      listShortcuts={LIST_SHORTCUTS}
      saving={saving}
      canSave={canSave}
      error={saveError}
      onSave={handleSave}
      cancelVariant="secondary"
      saveVariant="primary"
    >
      {({ isListActive, enterButtons, isCompact }) => (
        <>
          <StorageSelector
            value={effectiveStorage}
            onChange={setStorage}
            isActive={isListActive}
            onDownBoundary={enterButtons}
          />
          {isCompact ? (
            <Text color={tokens.info}>Changes take effect after saving.</Text>
          ) : (
            <Callout variant="info">
              <Text>Changes will take effect immediately after saving.</Text>
            </Callout>
          )}
        </>
      )}
    </SettingsFormScreen>
  );
}
