import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Shortcut } from "@diffgazer/core/schemas/ui";
import { getErrorMessage } from "@diffgazer/core/errors";
import { Button } from "@diffgazer/ui/components/button";
import { CardLayout } from "@/components/ui/card-layout";
import { useKey, useScope } from "@diffgazer/keys";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useActionRowNavigation } from "@diffgazer/keys";
import { useSettings, useSaveSettings } from "@diffgazer/core/api/hooks";
import { buildLensOptions } from "@diffgazer/core/schemas/events";
import type { LensId } from "@diffgazer/core/schemas/review";
import { AnalysisSelectorContent } from "./analysis-selector-content";

type ViewState = "loading" | "empty" | "error" | "success";

function isLensId(value: string, lensOptions: Array<{ id: LensId }>): value is LensId {
  return lensOptions.some((lens) => lens.id === value);
}

export function SettingsAnalysisPage() {
  const navigate = useNavigate();
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const settingsQuery = useSettings();
  const settings = settingsQuery.data;
  const settingsError = settingsQuery.error?.message ?? null;
  const saveSettings = useSaveSettings();
  const [selectedLenses, setSelectedLenses] = useState<LensId[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSaving = saveSettings.isPending;

  const lensOptions = buildLensOptions();
  const defaultLenses = settings?.defaultLenses ?? [];
  const persistedLenses = defaultLenses.filter((lens): lens is LensId => isLensId(lens, lensOptions));
  const fallbackLenses = lensOptions.map((lens) => lens.id);
  const currentLenses = persistedLenses.length > 0 ? persistedLenses : fallbackLenses;
  const effectiveLenses = selectedLenses ?? currentLenses;
  const hasLensSelection = effectiveLenses.length > 0;

  const viewState: ViewState = (() => {
    if (settingsQuery.isLoading) return "loading";
    if (settingsQuery.error) return "error";
    if (lensOptions.length === 0) return "empty";
    return "success";
  })();

  const isDirty = (() => {
    if (!settings || selectedLenses === null) return false;
    return (
      currentLenses.length !== selectedLenses.length ||
      currentLenses.some((lens) => !selectedLenses.includes(lens))
    );
  })();

  useScope("settings-analysis");
  useKey("Escape", () => navigate({ to: "/settings" }));

  const canSave = viewState === "success" && !isSaving && isDirty && hasLensSelection;
  const isSaveDisabled = !canSave;

  const handleCancel = () => navigate({ to: "/settings" });

  const handleSave = async () => {
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
    enabled: viewState === "success",
    actionCount: 2,
    disabledActions: [isSaving, isSaveDisabled],
    disabledFocusFallbackRef: focusFallbackRef,
    onAction: (index) => {
      if (index === 0) handleCancel();
      else if (index === 1 && canSave) void handleSave();
    },
  });

  const isButtonsZone = viewState === "success" ? footer.inActions : true;

  useEffect(() => {
    if (viewState === "success") {
      footer.reset();
    }
  }, [viewState]);

  const footerShortcuts: Shortcut[] = isButtonsZone
    ? viewState === "success"
      ? [
          { key: "←/→", label: "Move Action" },
          {
            key: "Enter/Space",
            label: footer.focusedIndex === 0 ? "Cancel" : "Save",
            disabled: footer.isFocusedActionDisabled,
          },
        ]
      : [{ key: "Enter/Space", label: "Back" }]
    : [
        { key: "↑/↓", label: "Navigate" },
        { key: "Enter/Space", label: "Toggle Lens" },
      ];

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts: [{ key: "Esc", label: "Back" }],
  });

  useKey("Enter", handleCancel, { enabled: isButtonsZone && viewState !== "success" });
  useKey(" ", handleCancel, { enabled: isButtonsZone && viewState !== "success" });

  return (
    <CardLayout
      title="Analysis Settings"
      subtitle="Choose which agents run during reviews."
      contentInactive={isButtonsZone && viewState === "success"}
      footer={
        <>
          <Button
            {...footer.getActionProps(0)}
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            highlighted={isButtonsZone && footer.focusedIndex === 0 && !isSaving}
          >
            Cancel
          </Button>
          <Button
            {...footer.getActionProps(1)}
            variant="success"
            onClick={handleSave}
            disabled={!canSave}
            highlighted={isButtonsZone && footer.focusedIndex === 1 && canSave}
          >
            {isSaving ? "Saving..." : "Save"}
          </Button>
        </>
      }
    >
      {viewState === "loading" ? (
        <p className="text-tui-muted">Loading settings...</p>
      ) : viewState === "error" ? (
        <p className="text-tui-red text-sm">{settingsError ?? "Failed to load settings"}</p>
      ) : viewState === "empty" ? (
        <p className="text-tui-muted text-sm">No analysis agents are currently available.</p>
      ) : (
        <div ref={focusFallbackRef} tabIndex={-1} className="space-y-3 focus:outline-none">
          <AnalysisSelectorContent
            options={lensOptions}
            value={effectiveLenses}
            onChange={setSelectedLenses}
            enabled={!isButtonsZone}
            autoFocusList={!isButtonsZone}
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
      )}
      {error && <p className="text-tui-red text-sm">{error}</p>}
    </CardLayout>
  );
}
