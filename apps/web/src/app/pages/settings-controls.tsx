import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useKey } from "@/hooks/keyboard";
import { useFooter } from "@/components/layout";
import { Panel, PanelHeader, PanelContent } from "@/components/ui/panel";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ControlsMode = "menu" | "keys";

const FOOTER_SHORTCUTS = [
  { key: "Enter", label: "Save" },
  { key: "Esc", label: "Back" },
];

export function SettingsControlsPage() {
  const navigate = useNavigate();
  const { setShortcuts, setRightShortcuts } = useFooter();
  const [controlsMode, setControlsMode] = useState<ControlsMode>("menu");

  useKey("Escape", () => navigate({ to: "/settings" }));

  const handleSave = () => {
    console.log("Saving controls mode:", controlsMode);
    navigate({ to: "/settings" });
  };

  const rightShortcuts = useMemo(
    () => [{ key: "MODE:", label: controlsMode === "menu" ? "Menu" : "Keys" }],
    [controlsMode]
  );

  useEffect(() => {
    setShortcuts(FOOTER_SHORTCUTS);
    setRightShortcuts(rightShortcuts);
  }, [rightShortcuts, setShortcuts, setRightShortcuts]);

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <Panel>
          <PanelHeader>NAVIGATION MODE</PanelHeader>
          <PanelContent className="space-y-6">
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setControlsMode("menu")}
                className={cn(
                  "w-full p-4 border text-left transition-colors",
                  controlsMode === "menu"
                    ? "border-[--tui-blue] bg-[--tui-blue]/10"
                    : "border-[--tui-border] hover:border-[--tui-blue]/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                      controlsMode === "menu"
                        ? "border-[--tui-blue]"
                        : "border-gray-500"
                    )}
                  >
                    {controlsMode === "menu" && (
                      <span className="w-2 h-2 rounded-full bg-[--tui-blue]" />
                    )}
                  </span>
                  <div>
                    <p className="font-bold text-[--tui-fg]">Menu Mode</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Navigate using arrow keys and Enter. Best for menu-driven
                      workflows.
                    </p>
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setControlsMode("keys")}
                className={cn(
                  "w-full p-4 border text-left transition-colors",
                  controlsMode === "keys"
                    ? "border-[--tui-blue] bg-[--tui-blue]/10"
                    : "border-[--tui-border] hover:border-[--tui-blue]/50"
                )}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={cn(
                      "w-4 h-4 rounded-full border-2 flex items-center justify-center",
                      controlsMode === "keys"
                        ? "border-[--tui-blue]"
                        : "border-gray-500"
                    )}
                  >
                    {controlsMode === "keys" && (
                      <span className="w-2 h-2 rounded-full bg-[--tui-blue]" />
                    )}
                  </span>
                  <div>
                    <p className="font-bold text-[--tui-fg]">
                      Keyboard Shortcuts
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Use single-key shortcuts for quick actions. Best for power
                      users.
                    </p>
                  </div>
                </div>
              </button>
            </div>

            <div className="h-px bg-[--tui-border]" />

            <div className="flex gap-2">
              <Button variant="primary" onClick={handleSave}>
                Save Changes
              </Button>
              <Button
                variant="ghost"
                onClick={() => navigate({ to: "/settings" })}
              >
                Cancel
              </Button>
            </div>
          </PanelContent>
        </Panel>
      </div>
    </div>
  );
}
