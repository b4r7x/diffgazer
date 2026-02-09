import { Panel, PanelContent, PanelHeader } from "@stargazer/ui";
import { usePageFooter } from "@/hooks/use-page-footer";

export function HelpPage() {
  usePageFooter({ shortcuts: [] });

  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Panel className="w-full max-w-2xl">
        <PanelHeader>Help</PanelHeader>
        <PanelContent>
          <p className="text-tui-muted">Help is not wired in this build.</p>
        </PanelContent>
      </Panel>
    </div>
  );
}
