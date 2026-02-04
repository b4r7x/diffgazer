import { useNavigate } from "@tanstack/react-router";
import { Button, Panel, PanelContent, PanelHeader } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { useKey } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { SETTINGS_SHORTCUTS } from "@/lib/navigation";

export function SettingsThemePage() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });

  useKey("Escape", () => navigate({ to: "/settings" }));

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Panel className="w-full max-w-2xl">
        <PanelHeader>Theme</PanelHeader>
        <PanelContent>
          <div className="space-y-4">
            <div>
              <div className="text-xs uppercase tracking-wider text-gray-500 font-bold">
                Appearance
              </div>
              <p className="text-gray-500 mt-1">
                Choose how the interface should look on this device.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="toggle"
                size="sm"
                data-active={theme === "auto"}
                onClick={() => setTheme("auto")}
              >
                Auto
              </Button>
              <Button
                variant="toggle"
                size="sm"
                data-active={theme === "dark"}
                onClick={() => setTheme("dark")}
              >
                Dark
              </Button>
              <Button
                variant="toggle"
                size="sm"
                data-active={theme === "light"}
                onClick={() => setTheme("light")}
              >
                Light
              </Button>
            </div>

            <div className="text-xs text-gray-500">Current: {theme.toUpperCase()}</div>
          </div>
        </PanelContent>
      </Panel>
    </div>
  );
}
