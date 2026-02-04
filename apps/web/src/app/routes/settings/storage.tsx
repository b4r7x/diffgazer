import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { SecretsStorage, SettingsConfig } from "@/types/config";
import { Button, Callout } from "@/components/ui";
import { StorageSelectorContent, WizardLayout } from "@/components/settings";
import { api } from "@/lib/api";
import { SETTINGS_SHORTCUTS } from "@/lib/navigation";
import { useKey } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";

export function SettingsStoragePage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<SettingsConfig | null>(null);
  const [storageChoice, setStorageChoice] = useState<SecretsStorage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });

  useKey("Escape", () => navigate({ to: "/settings" }));

  useEffect(() => {
    let active = true;

    api
      .getSettings()
      .then((data) => {
        if (!active) return;
        setSettings(data);
        setStorageChoice(data.secretsStorage ?? null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load settings");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

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

          {error && <p className="text-tui-red text-sm">{error}</p>}
        </div>
      )}
    </WizardLayout>
  );
}
