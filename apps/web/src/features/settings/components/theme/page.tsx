import { useSettings } from "@diffgazer/core/api/hooks";
import { getErrorMessage } from "@diffgazer/core/errors";
import { deriveSaveState, useSubmitGuard } from "@diffgazer/core/forms";
import { isSelectableTheme, resolveSelectableTheme } from "@diffgazer/core/schemas/config";
import { NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { useKey, useScope } from "@diffgazer/keys";
import { Callout } from "@diffgazer/ui/components/callout";
import { Panel } from "@diffgazer/ui/components/panel";
import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate } from "@tanstack/react-router";
import { useId, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import type { ResolvedTheme, WebTheme } from "@/types/theme";
import { useSettingsFormFooter } from "../../hooks/use-settings-form-footer";
import { SettingsFormActions } from "../settings-form-actions";
import { renderSettingsFormPending } from "../settings-form-pending";
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
  const selectorTitleId = useId();
  const previewTitleId = useId();
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
    // Same wrapper padding and top line as CardLayout; the two panes stack until lg
    // so the 768 column never gets narrow enough to wrap every radio description.
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pt-7 pb-4">
      <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-start gap-8 lg:grid-cols-[2fr_3fr]">
        {/* The selector is the interactive pane; the preview is passive output. */}
        {/* Focused tracks where focus actually is: once the user steps into the footer
            actions the selector is no longer the active pane, so the frame stops claiming
            it is. */}
        <Panel frame="viewfinder" focused={!footer.inActions} aria-labelledby={selectorTitleId}>
          <Panel.Label>
            <h1 id={selectorTitleId}>Theme Settings</h1>
          </Panel.Label>
          <Panel.Content spacing="none">
            <Panel.Description className="mb-4">Choose how Diffgazer appears.</Panel.Description>
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

            <div className="mt-6 space-y-4">
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

        <Panel frame="viewfinder" aria-labelledby={previewTitleId}>
          <Panel.Label>
            <h2 id={previewTitleId}>Live Preview</h2>
          </Panel.Label>
          <Panel.Content className="flex items-center justify-center">
            <ThemePreviewCard previewTheme={previewResolved} />
          </Panel.Content>
        </Panel>
      </div>
    </div>
  );
}
