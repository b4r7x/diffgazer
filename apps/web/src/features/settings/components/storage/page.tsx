import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { SecretsStorage } from "@stargazer/schemas/config";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { StorageSelectorContent } from "../storage-selector-content";
import { WizardLayout } from "../wizard-layout";
import { useSettings } from "@/hooks/use-settings";
import { api } from "@/lib/api";
import { SETTINGS_SHORTCUTS } from "@/config/navigation";
import { useKey } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";

export function SettingsStoragePage() {
  const navigate = useNavigate();
  const { settings, isLoading, error: settingsError } = useSettings();
  const [storageChoice, setStorageChoice] = useState<SecretsStorage | null>(null);
  const [storageInitialized, setStorageInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });

  useKey("Escape", () => navigate({ to: "/settings" }));

  // Initialize storage choice from settings once loaded
  useEffect(() => {
    if (!settings || storageInitialized) return;
    setStorageChoice(settings.secretsStorage ?? null);
    setStorageInitialized(true);
  }, [settings, storageInitialized]);

  const isDirty = settings?.secretsStorage !== storageChoice;

  const handleSave = async (): Promise<void> => {
    if (!storageChoice) return;
    setIsSaving(true);
    setError(null);
    try {
      await api.saveSettings({ secretsStorage: storageChoice });
      navigate({ to: "/settings" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
      setIsSaving(false);
    }
  };

  return (
    <WizardLayout
      title="Configure Secrets Storage"
      subtitle="Choose where API keys and sensitive data should be stored."
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => navigate({ to: "/settings" })}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleSave}
            disabled={isSaving || !storageChoice || !isDirty}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <p className="text-gray-500">Loading settings...</p>
      ) : (
        <div className="space-y-6">
          <StorageSelectorContent
            value={storageChoice}
            onChange={setStorageChoice}
            disabled={isSaving}
          />

          <Callout variant="info">
            Changes will take effect immediately after saving.
          </Callout>

          {(error || settingsError) && <p className="text-tui-red text-sm">{error || settingsError}</p>}
        </div>
      )}
    </WizardLayout>
  );
}
