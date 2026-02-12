import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { SecretsStorage } from "@diffgazer/schemas/config";
import type { Shortcut } from "@diffgazer/schemas/ui";
import { Button, Callout, CardLayout } from "@diffgazer/ui";
import { StorageSelectorContent } from "@/components/shared/storage-selector-content";
import { useSettings } from "@/hooks/use-settings";
import { api } from "@/lib/api";
import { useKey, useScope } from "keyscope";
import { useFooterNavigation } from "@/hooks/use-footer-navigation";
import { usePageFooter } from "@/hooks/use-page-footer";
import { cn } from "@/utils/cn";

export function SettingsStoragePage() {
  const navigate = useNavigate();
  const { settings, isLoading, error: settingsError } = useSettings();
  const [storageChoice, setStorageChoice] = useState<SecretsStorage | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveStorage = storageChoice ?? settings?.secretsStorage ?? null;

  useScope("settings-storage");
  useKey("Escape", () => navigate({ to: "/settings" }));

  const isDirty = settings?.secretsStorage !== effectiveStorage;
  const canSave = !isSaving && !!effectiveStorage && isDirty;

  const handleCancel = () => navigate({ to: "/settings" });

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
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

  const activateButton = (index: number) => {
    if (index === 0) handleCancel();
    else if (index === 1 && canSave) handleSave();
  };

  const { inFooter, focusedIndex, enterFooter } = useFooterNavigation({
    enabled: true,
    buttonCount: 2,
    onAction: activateButton,
    autoEnter: false,
  });

  const isButtonsZone = inFooter;

  const footerShortcuts: Shortcut[] = isButtonsZone
    ? [
        { key: "←/→", label: "Move Action" },
        {
          key: "Enter/Space",
          label: focusedIndex === 0 ? "Cancel" : "Save",
          disabled: focusedIndex === 1 && !canSave,
        },
      ]
    : [
        { key: "↑/↓", label: "Navigate" },
        { key: "Enter/Space", label: "Select Storage" },
      ];

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  });

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
            className={cn(isButtonsZone && focusedIndex === 0 && "ring-2 ring-tui-blue")}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleSave}
            disabled={isSaving || !effectiveStorage || !isDirty}
            className={cn(isButtonsZone && focusedIndex === 1 && "ring-2 ring-tui-blue")}
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
                enterFooter();
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
