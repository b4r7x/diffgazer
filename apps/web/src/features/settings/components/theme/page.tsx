import { useSettings } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { deriveSaveState, useSubmitGuard } from "@diffgazer/core/forms";
import { resolveSelectableTheme } from "@diffgazer/core/schemas/config";
import { NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { useKey, useScope } from "@diffgazer/keys";
import { Callout } from "@diffgazer/ui/components/callout";
import { Panel } from "@diffgazer/ui/components/panel";
import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import type { ResolvedTheme, WebTheme } from "@/types/theme";
import { useSettingsFormFooter } from "../../hooks/use-form-footer";
import { SettingsFormActions } from "../form-actions";
import { renderSettingsFormPending } from "../form-pending";
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

  const pendingUI = renderSettingsFormPending(
    settingsQuery,
    "Theme Settings",
    "Choose how Diffgazer appears.",
  );

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
  const focusFallbackRef = useRef<HTMLDivElement>(null);
  const [selectedTheme, setSelectedTheme] = useState<WebTheme>(savedTheme);
  const [focusedTheme, setFocusedTheme] = useState<WebTheme>(savedTheme);
  const [hoveredTheme, setHoveredTheme] = useState<WebTheme | null>(null);

  const previewTheme = hoveredTheme ?? focusedTheme;
  // Auto has no look of its own: the preview shows what it currently resolves to.
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
    onCancel: handleCancel,
    onSave: handleSave,
    focusFallbackRef,
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

  // Highlight moves whenever the keyboard or a pointer lands on a row, which is
  // also the moment the footer stops owning the keys.
  const highlightTheme = (theme: WebTheme) => {
    setFocusedTheme(theme);
    footer.reset();
  };

  useKey("Escape", handleCancel, { enabled: !isSaving });

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
      {/* Two full-height columns from md up; below md they stack full width. */}
      <div className="grid min-h-full w-full grid-cols-1 gap-6 md:grid-cols-[2fr_3fr]">
        {/* The app repoints --action to blue (theme-overrides.css), which turns
            tone="accent" blue app-wide; this pane keeps the violet --accent frame
            and marker so it reads distinct from the blue Live Preview panel. */}
        <Panel tone="accent" className="flex flex-col border-accent [--panel-tone:var(--accent)]">
          <Panel.Header>
            <Panel.Title>Theme Settings</Panel.Title>
          </Panel.Header>
          <Panel.Content spacing="none" className="flex flex-1 flex-col">
            {/* While both footer actions are disabled mid-save, the action row
                parks focus here; keeping the selector disabled for that window
                stops its re-arming autoFocus from yanking focus into the radios. */}
            <div ref={focusFallbackRef} tabIndex={-1} className="focus:outline-none">
              <ThemeSelectorContent
                value={selectedTheme}
                highlighted={focusedTheme}
                onHighlightChange={highlightTheme}
                onPreviewValueChange={setHoveredTheme}
                onChange={selectTheme}
                onEnter={onSave}
                enabled={!footer.inActions && !isSaving}
                onBoundaryReached={(direction) => {
                  if (direction === "down") {
                    footer.enterActions();
                  }
                }}
              />
            </div>

            <div className="mt-auto space-y-4 pt-6">
              <Callout tone="info" className="pointer-coarse:hidden">
                <Callout.Content>
                  Focus previews themes live. Space selects, Enter saves &amp; exits.
                </Callout.Content>
              </Callout>

              {saveError && (
                <Callout tone="error" live>
                  <Callout.Content>{saveError}</Callout.Content>
                </Callout>
              )}

              <div className="flex justify-end gap-3">
                <SettingsFormActions
                  footer={footer}
                  isSaving={isSaving}
                  canSave={canSave}
                  onCancel={handleCancel}
                  onSave={handleSave}
                />
              </div>
            </div>
          </Panel.Content>
        </Panel>

        <Panel tone="info" className="flex flex-col md:overflow-hidden">
          <Panel.Header>
            <Panel.Title>Live Preview</Panel.Title>
          </Panel.Header>
          <Panel.Content spacing="none" className="flex flex-1 items-center justify-center p-0">
            <ThemePreviewCard previewTheme={previewResolved} />
          </Panel.Content>
        </Panel>
      </div>
    </div>
  );
}
