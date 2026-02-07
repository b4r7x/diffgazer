import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { SecretsStorage } from "@stargazer/schemas/config";
import { Button, Callout, CardLayout } from "@stargazer/ui";
import { StorageSelectorContent } from "@/components/shared/storage-selector-content";
import { useSettings } from "@/hooks/use-settings";
import { api } from "@/lib/api";
import { SETTINGS_SHORTCUTS } from "@/config/navigation";
import { useKey } from "@stargazer/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";

export function SettingsStoragePage() {
  const navigate = useNavigate();
  const { settings, isLoading, error: settingsError } = useSettings();
  const [storageChoice, setStorageChoice] = useState<SecretsStorage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveStorage = storageChoice ?? settings?.secretsStorage ?? null;

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });

  useKey("Escape", () => navigate({ to: "/settings" }));

  const isDirty = settings?.secretsStorage !== effectiveStorage;

  const handleSave = async (): Promise<void> => {
    if (!effectiveStorage) return;
    setIsSaving(true);
    setError(null);
    try {
      await api.saveSettings({ secretsStorage: effectiveStorage });
      navigate({ to: "/settings" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
      setIsSaving(false);
    }
  };

  return (
    <CardLayout
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
            disabled={isSaving || !effectiveStorage || !isDirty}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      {isLoading ? (
        <p className="text-tui-muted">Loading settings...</p>
      ) : (
        <div className="space-y-6">
          <StorageSelectorContent
            value={effectiveStorage}
            onChange={setStorageChoice}
            disabled={isSaving}
          />

          <Callout variant="info">
            Changes will take effect immediately after saving.
          </Callout>

          {(error || settingsError) && <p className="text-tui-red text-sm">{error || settingsError}</p>}
        </div>
      )}
    </CardLayout>
  );
}
