import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { SecretsStorage, SettingsConfig } from "@/types/config";
import { Button, Panel, PanelContent, PanelHeader } from "@/components/ui";
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
      setSettings((current) =>
        current ? { ...current, secretsStorage: storageChoice } : current
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Panel className="w-full max-w-2xl">
        <PanelHeader>Secrets Storage</PanelHeader>
        <PanelContent>
          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500 font-bold">
                Storage Preference
              </div>
              <p className="text-gray-500 mt-1">
                Choose where API keys are stored for this machine.
              </p>
            </div>

            {isLoading ? (
              <p className="text-gray-500">Loading settings...</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="toggle"
                    size="sm"
                    data-active={storageChoice === "file"}
                    onClick={() => setStorageChoice("file")}
                    disabled={isSaving}
                  >
                    File (local)
                  </Button>
                  <Button
                    variant="toggle"
                    size="sm"
                    data-active={storageChoice === "keyring"}
                    onClick={() => setStorageChoice("keyring")}
                    disabled={isSaving}
                  >
                    Keyring
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Keyring support is stored as a preference. File storage remains the default backend.
                </p>
                <div className="text-xs text-gray-500">
                  Current: {settings?.secretsStorage ?? "not set"}
                </div>
              </div>
            )}

            {error ? <p className="text-tui-red">{error}</p> : null}

            <div>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSave}
                disabled={isSaving || !storageChoice || !isDirty}
              >
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </div>
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}
