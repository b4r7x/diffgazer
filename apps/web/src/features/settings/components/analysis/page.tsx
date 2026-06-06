import { matchQueryState, useSaveSettings, useSettings } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { usePageFooter } from "@diffgazer/core/footer";
import { buildLensOptions } from "@diffgazer/core/schemas/events";
import type { Shortcut } from "@diffgazer/core/schemas/presentation";
import type { LensId } from "@diffgazer/core/schemas/review";
import { useActionRowNavigation, useKey, useScope } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { CardLayout } from "@/components/ui/card-layout";
import { AnalysisSelectorContent } from "./selector-content";

const lensOptions = buildLensOptions();

function isLensId(value: string): value is LensId {
  return lensOptions.some((lens) => lens.id === value);
}

export function SettingsAnalysisPage() {
  const navigate = useNavigate();
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const settingsQuery = useSettings();
  const settings = settingsQuery.data;
  const saveSettings = useSaveSettings();
  const [selectedLenses, setSelectedLenses] = useState<LensId[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSaving = saveSettings.isPending;

  const defaultLenses = settings?.defaultLenses ?? [];
  const persistedLenses = defaultLenses.filter((lens): lens is LensId => isLensId(lens));
  const fallbackLenses = lensOptions.map((lens) => lens.id);
  const currentLenses = persistedLenses.length > 0 ? persistedLenses : fallbackLenses;
  const effectiveLenses = selectedLenses ?? currentLenses;
  const hasLensSelection = effectiveLenses.length > 0;

  const isDirty = (() => {
    if (!settings || selectedLenses === null) return false;
    return (
      currentLenses.length !== selectedLenses.length ||
      currentLenses.some((lens) => !selectedLenses.includes(lens))
    );
  })();

  useScope("settings-analysis");
  useKey("Escape", () => navigate({ to: "/settings" }), { enabled: !isSaving });

  const canSave = !isSaving && isDirty && hasLensSelection;

  const handleCancel = () => navigate({ to: "/settings" });

  const handleSave = async (): Promise<void> => {
    if (!canSave) return;
    setError(null);
    try {
      await saveSettings.mutateAsync({ defaultLenses: effectiveLenses });
      navigate({ to: "/settings" });
    } catch (err) {
      setError(getErrorMessage(err, "Failed to save settings"));
    }
  };

  const footer = useActionRowNavigation({
    enabled: true,
    actionCount: 2,
    disabledActions: [isSaving, !canSave],
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
        { key: "Enter/Space", label: "Toggle Lens" },
      ];

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  });

  const pendingUI = matchQueryState(settingsQuery, {
    loading: () => (
      <CardLayout
        title="Analysis Settings"
        subtitle="Choose which agents run during reviews."
      >
        <p className="text-tui-muted">Loading settings...</p>
      </CardLayout>
    ),
    error: (err) => (
      <CardLayout
        title="Analysis Settings"
        subtitle="Choose which agents run during reviews."
      >
        <p className="text-tui-red text-sm">{err.message}</p>
      </CardLayout>
    ),
    success: () => null,
  });

  if (pendingUI) return pendingUI;

  return (
    <CardLayout
      title="Analysis Settings"
      subtitle="Choose which agents run during reviews."
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
            disabled={!canSave}
            highlighted={footer.inActions && footer.focusedIndex === 1 && canSave}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      <div ref={focusFallbackRef} tabIndex={-1} className="space-y-3 focus:outline-none">
        <AnalysisSelectorContent
          options={lensOptions}
          value={effectiveLenses}
          onChange={setSelectedLenses}
          enabled={!footer.inActions}
          autoFocusList={!footer.inActions}
          disabled={isSaving}
          onBoundaryReached={(direction) => {
            if (direction === "down") {
              footer.enterActions();
            }
          }}
        />
        {!hasLensSelection && (
          <p className="text-tui-red text-xs">Select at least one agent.</p>
        )}
      </div>
      {error && <p className="text-tui-red text-sm">{error}</p>}
    </CardLayout>
  );
}
