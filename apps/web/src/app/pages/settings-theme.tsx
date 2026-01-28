import { useState, useMemo, useEffect } from "react";
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
  { key: "Enter", label: "Save" },
  { key: "Esc", label: "Cancel" },
];

export function SettingsThemePage() {
  const navigate = useNavigate();
  const { theme, resolved, setTheme } = useTheme();
  const [localTheme, setLocalTheme] = useState<WebTheme>(theme);

  useEffect(() => {
    setLocalTheme(theme);
  }, [theme]);

  const previewResolved: ResolvedTheme =
    localTheme === "auto" ? resolved : localTheme;

  const footerShortcuts = useMemo(() => FOOTER_SHORTCUTS, []);
  usePageFooter({ shortcuts: footerShortcuts });

  useKey("Escape", () => navigate({ to: "/settings" }));
  useKey("Enter", () => {
    setTheme(localTheme);
    navigate({ to: "/settings" });
  });

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0">
      <div className="grid grid-cols-[2fr_3fr] gap-6 w-full max-w-5xl min-h-0 h-full">
        {/* Left Panel - Theme Settings */}
        <Panel className="relative pt-4 flex flex-col">
          <Panel.Header variant="floating" className="text-tui-violet">
            Theme Settings
          </Panel.Header>
          <Panel.Content className="flex-1 flex flex-col">
            <ThemeSelectorContent
              value={localTheme as Theme}
              onChange={(v) => setLocalTheme(v as WebTheme)}
            />
            <div className="mt-auto pt-6">
              <Callout variant="info">
                Changes are previewed instantly. Press Enter to persist
                configuration.
              </Callout>
            </div>
          </Panel.Content>
        </Panel>

        {/* Right Panel - Live Preview */}
        <Panel className="relative pt-4 flex flex-col bg-black/20">
          <Panel.Header variant="floating" className="text-tui-blue">
            Live Preview
          </Panel.Header>
          <Panel.Content className="flex-1 flex items-center justify-center">
            <ThemePreviewCard previewTheme={previewResolved} />
          </Panel.Content>
        </Panel>
      </div>
    </div>
  );
}
