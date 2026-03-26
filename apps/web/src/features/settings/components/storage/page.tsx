import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { SecretsStorage } from "@diffgazer/schemas/config";
import type { Shortcut } from "@diffgazer/schemas/ui";
import { Button } from "diffui/components/button";
import { Callout } from "diffui/components/callout";
import { CardLayout } from "@/components/ui/card-layout";
import { StorageSelectorContent } from "@/components/shared/storage-selector-content";
import { useSettings, useSaveSettings, matchQueryState } from "@diffgazer/api/hooks";
import { useKey, useScope } from "keyscope";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useFooterNavigation } from "@/hooks/use-footer-navigation.js";
import { cn } from "@/utils/cn";

export function SettingsStoragePage() {
  const navigate = useNavigate();
  const settingsQuery = useSettings();
  const { data: settings, error: settingsQueryError } = settingsQuery;
  const settingsError = settingsQueryError?.message ?? null;
  const saveSettings = useSaveSettings();
  const [storageChoice, setStorageChoice] = useState<SecretsStorage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSaving = saveSettings.isPending;

  const effectiveStorage = storageChoice ?? settings?.secretsStorage ?? null;

  useScope("settings-storage");
  useKey("Escape", () => navigate({ to: "/settings" }));

  const isDirty = settings?.secretsStorage !== effectiveStorage;
  const canSave = !isSaving && !!effectiveStorage && isDirty;

  const handleCancel = () => navigate({ to: "/settings" });

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setError(null);
    try {
      await saveSettings.mutateAsync({ secretsStorage: effectiveStorage });
      navigate({ to: "/settings" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    }
  };

  const footer = useFooterNavigation({
    enabled: true,
    buttonCount: 2,
    onAction: (index) => {
      if (index === 0) handleCancel();
      else if (index === 1 && canSave) handleSave();
    },
  });

  const footerShortcuts: Shortcut[] = footer.inFooter
    ? [
        { key: "←/→", label: "Move Action" },
        {
          key: "Enter/Space",
          label: footer.focusedIndex === 0 ? "Cancel" : "Save",
          disabled: footer.focusedIndex === 1 && !canSave,
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

  const guard = matchQueryState(settingsQuery, {
    loading: () => (
      <CardLayout
        title="Configure Secrets Storage"
        subtitle="Choose where API keys and sensitive data should be stored."
      >
        <p className="text-tui-muted">Loading settings...</p>
      </CardLayout>
    ),
    error: (err) => (
      <CardLayout
        title="Configure Secrets Storage"
        subtitle="Choose where API keys and sensitive data should be stored."
      >
        <p className="text-tui-red text-sm">{err.message}</p>
      </CardLayout>
    ),
    success: () => null,
  });

  if (guard) return guard;

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
            className={cn(footer.inFooter && footer.focusedIndex === 0 && "ring-2 ring-tui-blue")}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleSave}
            disabled={isSaving || !effectiveStorage || !isDirty}
            className={cn(footer.inFooter && footer.focusedIndex === 1 && "ring-2 ring-tui-blue")}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        <StorageSelectorContent
          value={effectiveStorage}
          onChange={setStorageChoice}
          disabled={isSaving}
          enabled={!footer.inFooter}
          onBoundaryReached={(direction) => {
            if (direction === "down") {
              footer.enterFooter();
            }
          }}
        />

        <Callout variant="info" layout="none">
          Changes will take effect immediately after saving.
        </Callout>

        {(error || settingsError) && <p className="text-tui-red text-sm">{error || settingsError}</p>}
      </div>
    </CardLayout>
  );
}
