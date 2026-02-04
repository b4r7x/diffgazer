import { useNavigate } from "@tanstack/react-router";
import { Panel, PanelContent, PanelHeader } from "@/components/ui";
import { useKey } from "@/hooks/keyboard";
import { usePageFooter } from "@/hooks/use-page-footer";
import { SETTINGS_SHORTCUTS } from "@/lib/navigation";

export function SettingsDiagnosticsPage() {
  const navigate = useNavigate();

  usePageFooter({ shortcuts: SETTINGS_SHORTCUTS });

  useKey("Escape", () => navigate({ to: "/settings" }));

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Panel className="w-full max-w-2xl">
        <PanelHeader>Diagnostics</PanelHeader>
        <PanelContent>
          <p className="text-gray-500">
            Diagnostics are not wired in this build.
          </p>
        </PanelContent>
      </Panel>
    </div>
  );
}
