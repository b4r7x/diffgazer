import { useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { WebTheme, ResolvedTheme } from "@/types/theme";
import { Panel, PanelContent, PanelHeader, Callout, Button } from "@stargazer/ui";
import { ThemeSelectorContent } from "../theme-selector-content";
import { ThemePreviewCard } from "../theme-preview-card";
import { useTheme } from "@/hooks/use-theme";
import { useKey, useScope } from "@stargazer/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { cn } from "@/utils/cn";

const FOOTER_SHORTCUTS = [
  { key: "↑/↓", label: "Navigate" },
  { key: "Space", label: "Select" },
  { key: "Enter", label: "Save & Exit" },
  { key: "Esc", label: "Cancel" },
];

function resolveTheme(theme: WebTheme, systemResolved: ResolvedTheme): ResolvedTheme {
  return theme === "auto" ? systemResolved : theme;
}

type FocusZone = "list" | "buttons";
const BUTTONS_COUNT = 2;

export function SettingsThemePage() {
  const navigate = useNavigate();
  const { theme: savedTheme, resolved: systemResolved, setTheme, setPreview } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<WebTheme>(savedTheme);
  const [previewOverride, setPreviewOverride] = useState<WebTheme | null>(null);
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [buttonIndex, setButtonIndex] = useState(0);

  const previewTheme = previewOverride ?? selectedTheme;
  const previewResolved = resolveTheme(previewTheme, systemResolved);

  // Apply live preview to the full page
  useEffect(() => {
    setPreview(previewResolved);
    return () => setPreview(null);
  }, [previewResolved, setPreview]);

  usePageFooter({ shortcuts: FOOTER_SHORTCUTS });
  useScope("settings-theme");

  const isDirty = selectedTheme !== savedTheme;
  const isButtonsZone = focusZone === "buttons";

  const handleCancel = () => navigate({ to: "/settings" });

  const handleSave = () => {
    if (isDirty) {
      setTheme(selectedTheme);
    }
    navigate({ to: "/settings" });
  };

  const handleEnterOnList = (value: string) => {
    setSelectedTheme(value as WebTheme);
    setTheme(value as WebTheme);
    navigate({ to: "/settings" });
  };

  // Escape always cancels
  useKey("Escape", handleCancel);

  // Button zone navigation
  useKey("ArrowUp", () => {
    setFocusZone("list");
    setButtonIndex(0);
  }, { enabled: isButtonsZone });

  useKey("ArrowDown", () => {}, { enabled: isButtonsZone });

  useKey("ArrowLeft", () => setButtonIndex(Math.max(0, buttonIndex - 1)), {
    enabled: isButtonsZone,
  });

  useKey("ArrowRight", () => setButtonIndex(Math.min(BUTTONS_COUNT - 1, buttonIndex + 1)), {
    enabled: isButtonsZone,
  });

  const activateButton = () => {
    if (buttonIndex === 0) handleCancel();
    else if (buttonIndex === 1) handleSave();
  };

  useKey("Enter", activateButton, { enabled: isButtonsZone });
  useKey(" ", activateButton, { enabled: isButtonsZone });

  return (
    <div className="flex-1 flex flex-col p-6 min-h-0">
      <div className="grid grid-cols-[2fr_3fr] gap-6 w-full h-full min-h-0">
        {/* Left Panel - Theme Settings */}
        <Panel className="relative pt-4 flex flex-col h-full">
          <PanelHeader variant="floating" className="text-tui-violet">
            Theme Settings
          </PanelHeader>
          <PanelContent className="flex-1 flex flex-col">
            <ThemeSelectorContent
              value={selectedTheme}
              onChange={setSelectedTheme as (v: string) => void}
              onEnter={handleEnterOnList as (v: string) => void}
              onFocus={(v) => setPreviewOverride(v as WebTheme)}
              enabled={!isButtonsZone}
              onBoundaryReached={(direction) => {
                if (direction === "down") {
                  setFocusZone("buttons");
                }
              }}
            />

            <div className="mt-auto pt-6 space-y-4">
              <Callout variant="info">
                Focus previews themes live. Space selects, Enter saves &amp; exits.
              </Callout>

              <div className="flex justify-end gap-3">
                <Button
                  variant="ghost"
                  onClick={handleCancel}
                  className={cn(isButtonsZone && buttonIndex === 0 && "ring-2 ring-tui-blue")}
                >
                  Cancel
                </Button>
                <Button
                  variant="success"
                  onClick={handleSave}
                  disabled={!isDirty}
                  className={cn(isButtonsZone && buttonIndex === 1 && "ring-2 ring-tui-blue")}
                >
                  Save
                </Button>
              </div>
            </div>
          </PanelContent>
        </Panel>

        {/* Right Panel - Live Preview */}
        <Panel className="relative pt-4 flex flex-col h-full overflow-hidden">
          <PanelHeader variant="floating" className="text-tui-blue">
            Live Preview
          </PanelHeader>
          <PanelContent className="flex-1 flex items-center justify-center p-0">
            <ThemePreviewCard previewTheme={previewResolved} />
          </PanelContent>
        </Panel>
      </div>
    </div>
  );
}
