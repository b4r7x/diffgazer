import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Shortcut } from "@diffgazer/core/schemas/ui";
import { getErrorMessage } from "@diffgazer/core/errors";
import { Button } from "@diffgazer/ui/components/button";
import { CardLayout } from "@/components/ui/card-layout";
import { useKey, useScope } from "@diffgazer/keys";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useFooterNavigation } from "@/hooks/use-footer-navigation.js";
import { useSettings, useSaveSettings } from "@diffgazer/core/api/hooks";
import { cn } from "@diffgazer/core/cn";
import { buildLensOptions } from "@diffgazer/core/schemas/events";
import type { LensId } from "@diffgazer/core/schemas/review";
import { AnalysisSelectorContent } from "./analysis-selector-content";

type ViewState = "loading" | "empty" | "error" | "success";

export function SettingsAnalysisPage() {
  const navigate = useNavigate();
  const settingsQuery = useSettings();
  const settings = settingsQuery.data;
  const settingsError = settingsQuery.error?.message ?? null;
  const saveSettings = useSaveSettings();
  const [selectedLenses, setSelectedLenses] = useState<LensId[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isSaving = saveSettings.isPending;

  const lensOptions = buildLensOptions();
  const defaultLenses = settings?.defaultLenses ?? [];
  const availableLensIds = new Set(lensOptions.map((lens) => lens.id));
  const persistedLenses = defaultLenses.filter((lens): lens is LensId => availableLensIds.has(lens as LensId));
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

  const footer = useFooterNavigation({
    enabled: viewState === "success",
    buttonCount: 2,
    onAction: (index) => {
      if (index === 0) handleCancel();
      else if (index === 1 && canSave) void handleSave();
    },
  });

  // When not in "success" view, buttons zone is always active (for the "Back" action)
  const isButtonsZone = viewState === "success" ? footer.inFooter : true;

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
            disabled: footer.focusedIndex === 1 && !canSave,
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

  // Non-success views still need Enter/Space to go back
  useKey("Enter", handleCancel, { enabled: isButtonsZone && viewState !== "success" });
  useKey(" ", handleCancel, { enabled: isButtonsZone && viewState !== "success" });

  return (
    <CardLayout
      title="Analysis Settings"
      subtitle="Choose which agents run during reviews."
      footer={
        <>
          <Button
            variant="ghost"
            onClick={handleCancel}
            disabled={isSaving}
            className={cn(isButtonsZone && footer.focusedIndex === 0 && "ring-2 ring-tui-blue")}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleSave}
            disabled={!canSave}
            className={cn(isButtonsZone && footer.focusedIndex === 1 && "ring-2 ring-tui-blue")}
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
        <div className="space-y-3">
          <AnalysisSelectorContent
            options={lensOptions}
            value={effectiveLenses}
            onChange={setSelectedLenses}
            enabled={!isButtonsZone}
            disabled={isSaving}
            onBoundaryReached={(direction) => {
              if (direction === "down") {
                footer.enterFooter();
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
