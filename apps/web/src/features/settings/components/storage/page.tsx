import { useSettings } from "@diffgazer/core/api/hooks";
import { deriveSaveState } from "@diffgazer/core/forms";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import { NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { useScope } from "@diffgazer/keys";
import { Callout } from "@diffgazer/ui/components/callout";
import { useRef, useState } from "react";
import { StorageSelectorContent } from "@/components/shared/storage-selector-content";
import { useSettingsFormActions } from "../../hooks/use-settings-form-actions";
import { SettingsFormPage } from "../form-page";

export function SettingsStoragePage() {
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const settingsQuery = useSettings();
  const { data: settings } = settingsQuery;
  const [storageChoice, setStorageChoice] = useState<SecretsStorage | null>(null);

  const { effective: effectiveStorage, isDirty } = deriveSaveState<SecretsStorage | null>({
    persisted: settings?.secretsStorage,
    choice: storageChoice,
    saving: false,
    fallback: null,
  });

  useScope("settings-storage");

  const actions = useSettingsFormActions({
    canSave: !!effectiveStorage && isDirty,
    getSettingsPayload: () => ({ secretsStorage: effectiveStorage }),
    contentShortcuts: [NAVIGATE_SHORTCUT, { key: "Enter/Space", label: "Select Storage" }],
    focusFallbackRef,
  });
  const { canSave, error, footer, isSaving, onCancel, onSave } = actions;

  return (
    <SettingsFormPage
      title="Configure Secrets Storage"
      subtitle="Choose where API keys and sensitive data should be stored."
      query={settingsQuery}
      footer={footer}
      isSaving={isSaving}
      canSave={canSave}
      onCancel={onCancel}
      onSave={onSave}
    >
      <div ref={focusFallbackRef} tabIndex={-1} className="space-y-6 focus:outline-none">
        <StorageSelectorContent
          value={effectiveStorage}
          onChange={setStorageChoice}
          disabled={isSaving}
          keyboardNavigation={!footer.inActions}
          autoFocusList={!footer.inActions}
          onFocus={() => footer.reset()}
          onBoundaryReached={(direction) => {
            if (direction === "down") {
              footer.enterActions();
            }
          }}
        />

        <Callout tone="info">
          <Callout.Content>Changes will take effect immediately after saving.</Callout.Content>
        </Callout>

        {error && (
          <Callout tone="error" live className="text-sm">
            <Callout.Content>{error}</Callout.Content>
          </Callout>
        )}
      </div>
    </SettingsFormPage>
  );
}
