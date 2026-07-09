import { getErrorMessage } from "@diffgazer/core/errors";
import { deriveSaveState, useSubmitGuard } from "@diffgazer/core/forms";
import { isSelectableTheme, SELECTABLE_THEME_OPTIONS } from "@diffgazer/core/schemas/config";
import { NAVIGATE_SHORTCUT } from "@diffgazer/core/schemas/presentation";
import { useKey, useScope } from "@diffgazer/keys";
import { Button } from "@diffgazer/ui/components/button";
import { Callout } from "@diffgazer/ui/components/callout";
import { Panel } from "@diffgazer/ui/components/panel";
import { toast } from "@diffgazer/ui/components/toast";
import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import type { ResolvedTheme, WebTheme } from "@/types/theme";
import { useSettingsFormFooter } from "../../hooks/use-settings-form-footer";
import { ThemePreviewCard } from "./preview-card";
import { ThemeSelectorContent } from "./selector-content";

function resolveTheme(theme: WebTheme, system: ResolvedTheme): ResolvedTheme {
  return theme === "auto" ? system : theme;
}

export function SettingsThemePage() {
  const { theme: savedTheme, system, setTheme } = useTheme();
  const navigate = useNavigate();
  const [saveError, setSaveError] = useState<string | null>(null);
  const { isSubmitting, withGuard } = useSubmitGuard();

  // Save state must live above the `key={savedTheme}` remount, or the error and
  // pending guard reset each time the provider rolls the effective theme.
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

  return (
    <SettingsThemeEditor
      key={savedTheme}
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
  const previewResolved = resolveTheme(previewTheme, system);
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
    disabledActions: [false, isSaveDisabled],
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

  const themeOptions = SELECTABLE_THEME_OPTIONS.map((option) => option.value);

  const moveFocus = (direction: 1 | -1) => {
    const current = focusedTheme ?? selectedTheme;
    const idx = themeOptions.indexOf(current);
    const next = idx + direction;
    if (next < 0) return;
    if (next >= themeOptions.length) {
      footer.enterActions();
      return;
    }
    const nextTheme = themeOptions[next];
    if (!nextTheme) return;
    setFocusedTheme(nextTheme);
  };

  useKey("Escape", handleCancel);

  useKey("ArrowDown", () => moveFocus(1), { enabled: !footer.inActions });
  useKey("ArrowUp", () => moveFocus(-1), { enabled: !footer.inActions });

  useKey(
    " ",
    () => {
      const theme = focusedTheme ?? selectedTheme;
      selectTheme(theme);
    },
    { enabled: !footer.inActions },
  );

  useKey(
    "Enter",
    () => {
      const theme = focusedTheme ?? selectedTheme;
      handleEnterOnList(theme);
    },
    { enabled: !footer.inActions },
  );

  return (
    <div className="flex-1 flex flex-col p-6 min-h-0">
      <div className="grid grid-cols-[2fr_3fr] gap-6 w-full h-full min-h-0">
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
              enabled={!footer.inActions}
              onBoundaryReached={(direction) => {
                if (direction === "down") {
                  footer.enterActions();
                }
              }}
            />

            <div className="mt-auto pt-6 space-y-4">
              <Callout tone="info">
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
                  highlighted={footer.inActions && footer.focusedIndex === 0}
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

        <Panel tone="info" className="relative pt-4 flex flex-col h-full overflow-hidden">
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
