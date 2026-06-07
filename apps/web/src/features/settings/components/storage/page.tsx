import { matchQueryState, useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { usePageFooter } from "@diffgazer/core/footer";
import { deriveSaveState } from "@diffgazer/core/forms";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import { useActionRowNavigation, useKey, useScope } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { StorageSelectorContent } from "@/components/shared/storage-selector-content";
import { CardLayout } from "@/components/ui/card-layout";

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
  const isSaveDisabled = !canSave;

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

  const footer = useActionRowNavigation({
    enabled: true,
    actionCount: 2,
    disabledActions: [isSaving, isSaveDisabled],
    disabledFocusFallbackRef: focusFallbackRef,
    onAction: (index) => {
      if (index === 0) handleCancel();
      else if (index === 1 && canSave) void handleSave();
    },
  });

  const footerShortcuts: Shortcut[] = footer.inActions
    ? [
        { key: "←/→", label: "Move Action" },
        {
          key: "Enter/Space",
          label: footer.focusedIndex === 0 ? "Cancel" : "Save",
          disabled: footer.isFocusedActionDisabled,
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
      contentInactive={footer.inActions}
      footer={
        <>
          <Button
            {...footer.getActionProps(0)}
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            highlighted={footer.inActions && footer.focusedIndex === 0 && !isSaving}
          >
            Cancel
          </Button>
          <Button
            {...footer.getActionProps(1)}
            variant="success"
            onClick={handleSave}
            disabled={isSaving || !effectiveStorage || !isDirty}
            highlighted={footer.inActions && footer.focusedIndex === 1 && canSave}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </>
      }
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
          <p className="text-tui-red text-sm">{error || settingsError}</p>
        )}
      </div>
    </CardLayout>
  );
}
