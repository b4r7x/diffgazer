import { matchQueryState, useSettings } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { deriveSaveState, useSubmitGuard } from "@diffgazer/core/forms";
import { isSelectableTheme, resolveSelectableTheme } from "@diffgazer/core/schemas/config";
import { NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { useKey, useScope } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { Panel } from "@diffgazer/ui/components/panel";
import { Spinner } from "@diffgazer/ui/components/spinner";
import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { CardLayout } from "@/components/ui/card-layout";
import { useTheme } from "@/hooks/use-theme";
import type { ResolvedTheme, WebTheme } from "@/types/theme";
import { useSettingsFormFooter } from "../../hooks/use-settings-form-footer";
import { ThemePreviewCard } from "./preview-card";
import { ThemeSelectorContent } from "./selector-content";

export function SettingsThemePage() {
  const settingsQuery = useSettings();
  const { theme: savedTheme, system, setTheme } = useTheme();
  const navigate = useNavigate();
  const [saveError, setSaveError] = useState<string | null>(null);
  const { isSubmitting, withGuard } = useSubmitGuard();

  const saveAndExit = (theme: WebTheme) => {
    void withGuard(async () => {
      setSaveError(null);
      try {
        await setTheme(theme);
        navigate({ to: "/settings" });
      } catch (error) {
        const message = getErrorMessage(error, "Could not persist theme settings.");
        setSaveError(message);
        toast.error("Failed to Save Theme", { message });
      }
    });
  };

  const pendingUI = matchQueryState(settingsQuery, {
    loading: () => (
      <CardLayout title="Theme Settings" subtitle="Choose how Diffgazer appears.">
        <Spinner className="text-muted-foreground">Loading settings...</Spinner>
      </CardLayout>
    ),
    error: (error) => (
      <CardLayout title="Theme Settings" subtitle="Choose how Diffgazer appears.">
        <Callout tone="error" live className="text-sm">
          <Callout.Content>{error.message}</Callout.Content>
        </Callout>
      </CardLayout>
    ),
    success: () => null,
  });

  if (pendingUI) return pendingUI;

  return (
    <SettingsThemeEditor
      savedTheme={savedTheme}
      system={system}
      saveError={saveError}
      isSaving={isSubmitting}
      onSave={saveAndExit}
    />
  );
}

interface SettingsThemeEditorProps {
  savedTheme: WebTheme;
  system: ResolvedTheme;
  saveError: string | null;
  isSaving: boolean;
  onSave: (theme: WebTheme) => void;
}

function SettingsThemeEditor({
  savedTheme,
  system,
  saveError,
  isSaving,
  onSave,
}: SettingsThemeEditorProps) {
  const navigate = useNavigate();
  const [selectedTheme, setSelectedTheme] = useState<WebTheme>(savedTheme);
  const [focusedTheme, setFocusedTheme] = useState<WebTheme | null>(savedTheme);
  const [hoveredTheme, setHoveredTheme] = useState<WebTheme | null>(null);

  const previewTheme = hoveredTheme ?? focusedTheme ?? selectedTheme;
  const previewResolved = resolveSelectableTheme(previewTheme, system);
  useScope("settings-theme");

  const { canSave } = deriveSaveState<WebTheme>({
    persisted: savedTheme,
    choice: selectedTheme,
    saving: isSaving,
    fallback: savedTheme,
  });
  const isSaveDisabled = !canSave;

  const handleCancel = () => navigate({ to: "/settings" });

  const handleSave = () => {
    if (!canSave) return;
    onSave(selectedTheme);
  };

  const footer = useSettingsFormFooter({
    disabledActions: [isSaving, isSaveDisabled],
    canSave,
    onCancel: handleCancel,
    onSave: handleSave,
    contentShortcuts: [
      NAVIGATE_SHORTCUT,
      { key: "Space", label: "Select Theme" },
      { key: "Enter", label: "Save & Exit" },
    ],
    rightShortcuts: [{ key: "Esc", label: "Cancel" }],
  });

  const selectTheme = (theme: WebTheme) => {
    setSelectedTheme(theme);
    setFocusedTheme(theme);
  };

  const handleChange = (value: string) => {
    if (isSelectableTheme(value)) selectTheme(value);
  };

  const handleEnterOnList = (value: string) => {
    if (!isSelectableTheme(value)) return;
    selectTheme(value);
    onSave(value);
  };

  useKey("Escape", handleCancel, { enabled: !isSaving });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      <div className="grid min-h-full w-full grid-cols-1 gap-6 md:grid-cols-[2fr_3fr]">
        <Panel tone="accent" className="relative pt-4 flex flex-col h-full">
          <Panel.Header>
            <Panel.Title>Theme Settings</Panel.Title>
          </Panel.Header>
          <Panel.Content className="flex-1 flex flex-col">
            <ThemeSelectorContent
              value={selectedTheme}
              highlighted={focusedTheme}
              onHighlightChange={(value) => {
                if (isSelectableTheme(value)) setFocusedTheme(value);
              }}
              onPreviewValueChange={(value) => {
                setHoveredTheme(isSelectableTheme(value) ? value : null);
              }}
              onChange={handleChange}
              onEnter={handleEnterOnList}
              onSelect={handleChange}
              onFocus={() => footer.reset()}
              enabled={!footer.inActions}
              onBoundaryReached={(direction) => {
                if (direction === "down") {
                  footer.enterActions();
                }
              }}
            />

            <div className="mt-auto pt-6 space-y-4">
              <Callout tone="info" className="pointer-coarse:hidden">
                <Callout.Content>
                  Focus previews themes live. Space selects, Enter saves &amp; exits.
                </Callout.Content>
              </Callout>

              {saveError && (
                <Callout tone="error" live className="text-sm">
                  <Callout.Content>{saveError}</Callout.Content>
                </Callout>
              )}

              <div className="flex justify-end gap-3">
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
                  Save
                </Button>
              </div>
            </div>
          </Panel.Content>
        </Panel>

        <Panel tone="info" className="relative pt-4 flex flex-col md:h-full md:overflow-hidden">
          <Panel.Header>
            <Panel.Title>Live Preview</Panel.Title>
          </Panel.Header>
          <Panel.Content className="flex-1 flex items-center justify-center p-0">
            <ThemePreviewCard previewTheme={previewResolved} />
          </Panel.Content>
        </Panel>
      </div>
    </div>
  );
}
