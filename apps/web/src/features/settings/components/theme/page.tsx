import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { WebTheme, ResolvedTheme } from "@/types/theme";
import { Panel, PanelContent, PanelHeader } from "@/components/ui/containers";
import { Callout } from "@/components/ui/callout";
import { ThemeSelectorContent } from "../theme-selector-content";
import { ThemePreviewCard } from "../theme-preview-card";
import { useTheme } from "@/hooks/use-theme";
import { useKey } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { SETTINGS_SHORTCUTS } from "@/config/navigation";

export function SettingsThemePage() {
  const navigate = useNavigate();
  const { theme, resolved, setTheme } = useTheme();
  const [previewOverride, setPreviewOverride] = useState<WebTheme | null>(null);

  const previewTheme = previewOverride ?? theme;
  const previewResolved: ResolvedTheme =
    previewTheme === "auto" ? resolved : previewTheme;

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });

  useKey("Escape", () => navigate({ to: "/settings" }));
  useKey("Enter", () => {
    setTheme(previewTheme);
    navigate({ to: "/settings" });
  });

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
              value={theme}
              onChange={(v) => {
                if (v === "terminal") return;
                setTheme(v);
              }}
              onFocus={(v) => {
                if (v === "terminal") return;
                setPreviewOverride(v);
              }}
            />
            <div className="mt-auto pt-6">
              <Callout variant="info">
                Hover to preview. Press Space to apply theme instantly.
              </Callout>
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
