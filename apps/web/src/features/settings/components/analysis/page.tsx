import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Shortcut } from "@diffgazer/schemas/ui";
import { Button, CardLayout } from "@diffgazer/ui";
import { useKey, useScope } from "keyscope";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useSettings } from "@/hooks/use-settings";
import { api } from "@/lib/api";
import { cn } from "@/utils/cn";
import { AGENT_METADATA, LENS_TO_AGENT } from "@diffgazer/schemas/events";
import type { LensId } from "@diffgazer/schemas/review";
import { AnalysisSelectorContent, type AnalysisOption } from "./analysis-selector-content";

type FocusZone = "list" | "buttons";
type ViewState = "loading" | "empty" | "error" | "success";
const BUTTONS_COUNT = 2;

function buildLensOptions(): AnalysisOption[] {
  return (Object.entries(LENS_TO_AGENT) as Array<[LensId, keyof typeof AGENT_METADATA]>).map(([lensId, agentId]) => {
    const meta = AGENT_METADATA[agentId];
    return {
      id: lensId,
      label: meta.name,
      badgeLabel: meta.badgeLabel,
      badgeVariant: meta.badgeVariant ?? "info",
      description: meta.description,
    };
  });
}

export function SettingsAnalysisPage() {
  const navigate = useNavigate();
  const { settings, isLoading, error: settingsError, refresh } = useSettings();
  const [selectedLenses, setSelectedLenses] = useState<LensId[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [buttonIndex, setButtonIndex] = useState(0);

  const lensOptions = buildLensOptions();
  const defaultLenses = settings?.defaultLenses ?? [];
  const availableLensIds = new Set(lensOptions.map((lens) => lens.id));
  const persistedLenses = defaultLenses.filter((lens): lens is LensId => availableLensIds.has(lens as LensId));
  const fallbackLenses = lensOptions.map((lens) => lens.id);
  const currentLenses = persistedLenses.length > 0 ? persistedLenses : fallbackLenses;
  const effectiveLenses = selectedLenses ?? currentLenses;
  const hasLensSelection = effectiveLenses.length > 0;

  const viewState: ViewState = (() => {
    if (isLoading) return "loading";
    if (settingsError) return "error";
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

  useEffect(() => {
    if (viewState === "success") {
      setFocusZone("list");
    }
    setButtonIndex(0);
  }, [viewState]);

  useScope("settings-analysis");
  useKey("Escape", () => navigate({ to: "/settings" }));

  const isButtonsZone = viewState === "success" ? focusZone === "buttons" : true;
  const canSave = viewState === "success" && !isSaving && isDirty && hasLensSelection;

  const footerShortcuts: Shortcut[] = isButtonsZone
    ? viewState === "success"
      ? [
          { key: "←/→", label: "Move Action" },
          {
            key: "Enter/Space",
            label: buttonIndex === 0 ? "Cancel" : "Save",
            disabled: buttonIndex === 1 && !canSave,
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

  useKey("ArrowUp", () => {
    setFocusZone("list");
    setButtonIndex(0);
  }, { enabled: isButtonsZone && viewState === "success", preventDefault: true });

  useKey("ArrowDown", () => {}, { enabled: isButtonsZone && viewState === "success", preventDefault: true });

  useKey("ArrowLeft", () => setButtonIndex(Math.max(0, buttonIndex - 1)), {
    enabled: isButtonsZone && viewState === "success", preventDefault: true,
  });

  useKey("ArrowRight", () => setButtonIndex(Math.min(BUTTONS_COUNT - 1, buttonIndex + 1)), {
    enabled: isButtonsZone && viewState === "success", preventDefault: true,
  });

  const handleCancel = () => navigate({ to: "/settings" });

  const activateButton = () => {
    if (buttonIndex === 0) {
      handleCancel();
      return;
    }
    if (buttonIndex === 1 && canSave) {
      void handleSave();
    }
  };

  useKey("Enter", activateButton, { enabled: isButtonsZone });
  useKey(" ", activateButton, { enabled: isButtonsZone, preventDefault: true });

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setError(null);
    try {
      await api.saveSettings({ defaultLenses: effectiveLenses });
      await refresh();
      navigate({ to: "/settings" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
      setIsSaving(false);
    }
  };

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
            className={cn(isButtonsZone && buttonIndex === 0 && "ring-2 ring-tui-blue")}
          >
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleSave}
            disabled={!canSave}
            className={cn(isButtonsZone && buttonIndex === 1 && "ring-2 ring-tui-blue")}
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
                setFocusZone("buttons");
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
