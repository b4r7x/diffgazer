import { useMemo, useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import type { Theme } from "@repo/schemas";
import type { WebTheme, ResolvedTheme } from "@/types/theme";
import { useKey } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { useTheme } from "@/hooks/use-theme";
import { Panel } from "@/components/ui/panel";
import { Callout } from "@/components/ui/callout";
import { ThemeSelectorContent } from "@/components/settings/theme-selector-content";
import { ThemePreviewCard } from "@/components/theme";

const FOOTER_SHORTCUTS = [
  { key: "↑/↓", label: "Select" },
  { key: "Space", label: "Apply" },
  { key: "Enter", label: "Apply & Exit" },
  { key: "Esc", label: "Back" },
];

export function SettingsThemePage() {
  const navigate = useNavigate();
  const { theme, resolved, setTheme } = useTheme();
  const [previewTheme, setPreviewTheme] = useState<WebTheme>(theme);

  useEffect(() => {
    setPreviewTheme(theme);
  }, [theme]);

  const previewResolved: ResolvedTheme =
    previewTheme === "auto" ? resolved : previewTheme;

  const footerShortcuts = useMemo(() => FOOTER_SHORTCUTS, []);
  usePageFooter({ shortcuts: footerShortcuts });

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
          <Panel.Header variant="floating" className="text-tui-violet">
            Theme Settings
          </Panel.Header>
          <Panel.Content className="flex-1 flex flex-col">
            <ThemeSelectorContent
              value={theme as Theme}
              onChange={(v) => {
                setTheme(v as WebTheme);
              }}
              onFocus={(v) => setPreviewTheme(v as WebTheme)}
            />
            <div className="mt-auto pt-6">
              <Callout variant="info">
                Hover to preview. Press Space to apply theme instantly.
              </Callout>
            </div>
          </Panel.Content>
        </Panel>

        {/* Right Panel - Live Preview */}
        <Panel className="relative pt-4 flex flex-col h-full overflow-hidden">
          <Panel.Header variant="floating" className="text-tui-blue">
            Live Preview
          </Panel.Header>
          <Panel.Content className="flex-1 flex items-center justify-center p-0">
            <ThemePreviewCard previewTheme={previewResolved} />
          </Panel.Content>
        </Panel>
      </div>
    </div>
  );
}
