import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { SecretsStorage } from "@stargazer/schemas/config";
import { Button, Callout, CardLayout } from "@stargazer/ui";
import { StorageSelectorContent } from "@/components/shared/storage-selector-content";
import { useSettings } from "@/hooks/use-settings";
import { api } from "@/lib/api";
import { SETTINGS_SHORTCUTS } from "@/config/navigation";
import { useKey, useScope } from "@stargazer/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { cn } from "@/utils/cn";

type FocusZone = "list" | "buttons";
const BUTTONS_COUNT = 2;

export function SettingsStoragePage() {
  const navigate = useNavigate();
  const { settings, isLoading, error: settingsError } = useSettings();
  const [storageChoice, setStorageChoice] = useState<SecretsStorage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [buttonIndex, setButtonIndex] = useState(0);

  const effectiveStorage = storageChoice ?? settings?.secretsStorage ?? null;

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });

  useScope("settings-storage");
  useKey("Escape", () => navigate({ to: "/settings" }));

  const isDirty = settings?.secretsStorage !== effectiveStorage;
  const isButtonsZone = focusZone === "buttons";

  useKey("ArrowUp", () => {
    setFocusZone("list");
    setButtonIndex(0);
  }, { enabled: isButtonsZone });

  useKey("ArrowDown", () => {}, { enabled: isButtonsZone });

  useKey("ArrowLeft", () => setButtonIndex(Math.max(0, buttonIndex - 1)), {
    enabled: isButtonsZone,
  });

  useKey("ArrowRight", () => setButtonIndex(Math.min(BUTTONS_COUNT - 1, buttonIndex + 1)), {
    enabled: isButtonsZone,
  });

  const handleCancel = () => navigate({ to: "/settings" });

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

  const activateButton = () => {
    if (buttonIndex === 0) handleCancel();
    else if (buttonIndex === 1) handleSave();
  };

  useKey("Enter", activateButton, { enabled: isButtonsZone });
  useKey(" ", activateButton, { enabled: isButtonsZone });

  return (
    <CardLayout
      title="Configure Secrets Storage"
      subtitle="Choose where API keys and sensitive data should be stored."
      footer={
        <>
          <Button
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            className={cn(isButtonsZone && buttonIndex === 0 && "ring-2 ring-tui-blue")}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleSave}
            disabled={isSaving || !effectiveStorage || !isDirty}
            className={cn(isButtonsZone && buttonIndex === 1 && "ring-2 ring-tui-blue")}
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
            enabled={!isButtonsZone}
            onBoundaryReached={(direction) => {
              if (direction === "down") {
                setFocusZone("buttons");
              }
            }}
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
