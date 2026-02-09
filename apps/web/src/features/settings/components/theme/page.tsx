import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Shortcut } from "@diffgazer/schemas/ui";
import type { WebTheme, ResolvedTheme } from "@/types/theme";
import { Panel, PanelContent, PanelHeader, Callout, Button } from "@diffgazer/ui";
import { ThemeSelectorContent } from "../theme-selector-content";
import { ThemePreviewCard } from "../theme-preview-card";
import { useTheme } from "@/hooks/use-theme";
import { useKey, useScope } from "@diffgazer/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { cn } from "@/utils/cn";

function resolveTheme(theme: WebTheme, systemResolved?: ResolvedTheme | null): ResolvedTheme {
  return theme === "auto" ? (systemResolved ?? "dark") : theme;
}

type FocusZone = "list" | "buttons";
const BUTTONS_COUNT = 2;

export function SettingsThemePage() {
  const navigate = useNavigate();
  const { theme: savedTheme, resolved: systemResolved, setTheme } = useTheme();
  const [selectedTheme, setSelectedTheme] = useState<WebTheme>(savedTheme);
  const [focusedTheme, setFocusedTheme] = useState<WebTheme | null>(savedTheme);
  const [focusZone, setFocusZone] = useState<FocusZone>("list");
  const [buttonIndex, setButtonIndex] = useState(0);

  useEffect(() => {
    setSelectedTheme(savedTheme);
    setFocusedTheme(savedTheme);
  }, [savedTheme]);

  const previewTheme = focusedTheme ?? selectedTheme;
  const previewResolved = resolveTheme(previewTheme, systemResolved);
  useScope("settings-theme");

  const canSave = selectedTheme !== savedTheme;
  const isButtonsZone = focusZone === "buttons";

  const footerShortcuts: Shortcut[] = isButtonsZone
    ? [
        { key: "←/→", label: "Move Action" },
        {
          key: "Enter/Space",
          label: buttonIndex === 0 ? "Cancel" : "Save",
          disabled: buttonIndex === 1 && !canSave,
        },
      ]
    : [
        { key: "↑/↓", label: "Navigate" },
        { key: "Space", label: "Select Theme" },
        { key: "Enter", label: "Save & Exit" },
      ];

  usePageFooter({
    shortcuts: footerShortcuts,
    rightShortcuts: [{ key: "Esc", label: "Cancel" }],
  });

  const handleCancel = () => navigate({ to: "/settings" });

  const handleSave = () => {
    if (!canSave) return;
    setTheme(selectedTheme);
    navigate({ to: "/settings" });
  };

  const selectTheme = (theme: WebTheme) => {
    setSelectedTheme(theme);
    setFocusedTheme(theme);
  };

  const handleChange = (value: string) => {
    selectTheme(value as WebTheme);
  };

  const handleEnterOnList = (value: string) => {
    const theme = value as WebTheme;
    selectTheme(theme);
    setTheme(theme);
    navigate({ to: "/settings" });
  };

  useKey("Escape", handleCancel);

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
    else if (buttonIndex === 1 && canSave) handleSave();
  };

  useKey("Enter", activateButton, { enabled: isButtonsZone });
  useKey(" ", activateButton, { enabled: isButtonsZone });

  return (
    <div className="flex-1 flex flex-col p-6 min-h-0">
      <div className="grid grid-cols-[2fr_3fr] gap-6 w-full h-full min-h-0">
        <Panel className="relative pt-4 flex flex-col h-full">
          <PanelHeader variant="floating" className="text-tui-violet">
            Theme Settings
          </PanelHeader>
          <PanelContent className="flex-1 flex flex-col">
            <ThemeSelectorContent
              value={selectedTheme}
              focusedValue={focusedTheme}
              onFocusedValueChange={(v) => setFocusedTheme(v as WebTheme)}
              onChange={handleChange}
              onEnter={handleEnterOnList}
              onSelect={handleChange}
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
                  disabled={!canSave}
                  className={cn(isButtonsZone && buttonIndex === 1 && "ring-2 ring-tui-blue")}
                >
                  Save
                </Button>
              </div>
            </div>
          </PanelContent>
        </Panel>

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
