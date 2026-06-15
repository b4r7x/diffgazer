import { useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { deriveSaveState } from "@diffgazer/core/forms";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import { BACK_SHORTCUT, NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { useKey, useScope } from "@diffgazer/keys";
import { Callout } from "@diffgazer/ui/components/callout";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { StorageSelectorContent } from "@/components/shared/storage-selector-content";
import { useSettingsFormFooter } from "../../hooks/use-settings-form-footer";
import { SettingsFormPage } from "../form-page";

export function SettingsStoragePage() {
  const navigate = useNavigate();
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const settingsQuery = useSettings();
  const { data: settings, error: settingsQueryError } = settingsQuery;
  const settingsError = settingsQueryError?.message ?? null;
  const saveSettings = useSaveSettings();
  const [storageChoice, setStorageChoice] = useState<SecretsStorage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSaving = saveSettings.isPending;

  const { effective: effectiveStorage, isDirty } = deriveSaveState<SecretsStorage | null>({
    persisted: settings?.secretsStorage,
    choice: storageChoice,
    saving: isSaving,
    fallback: null,
  });

  useScope("settings-storage");
  useKey("Escape", () => navigate({ to: "/settings" }), { enabled: !isSaving });

  const canSave = !isSaving && !!effectiveStorage && isDirty;

  const handleCancel = () => navigate({ to: "/settings" });

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setError(null);
    try {
      await saveSettings.mutateAsync({ secretsStorage: effectiveStorage });
      navigate({ to: "/settings" });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save settings"));
    }
  };

  const footer = useSettingsFormFooter({
    disabledActions: [isSaving, !canSave],
    canSave,
    onCancel: handleCancel,
    onSave: () => void handleSave(),
    contentShortcuts: [NAVIGATE_SHORTCUT, { key: "Enter/Space", label: "Select Storage" }],
    rightShortcuts: [BACK_SHORTCUT],
    focusFallbackRef,
  });

  return (
    <SettingsFormPage
      title="Configure Secrets Storage"
      subtitle="Choose where API keys and sensitive data should be stored."
      query={settingsQuery}
      footer={footer}
      isSaving={isSaving}
      canSave={canSave}
      onCancel={handleCancel}
      onSave={() => void handleSave()}
    >
      <div ref={focusFallbackRef} tabIndex={-1} className="space-y-6 focus:outline-none">
        <StorageSelectorContent
          value={effectiveStorage}
          onChange={setStorageChoice}
          disabled={isSaving}
          keyboardNavigation={!footer.inActions}
          autoFocusList={!footer.inActions}
          onBoundaryReached={(direction) => {
            if (direction === "down") {
              footer.enterActions();
            }
          }}
        />

        <Callout tone="info">
          <Callout.Content>Changes will take effect immediately after saving.</Callout.Content>
        </Callout>

        {(error || settingsError) && (
          <Callout tone="error" live className="text-sm">
            <Callout.Content>{error || settingsError}</Callout.Content>
          </Callout>
        )}
      </div>
    </SettingsFormPage>
  );
}
