import { Panel, PanelContent, PanelHeader } from "@/components/ui";

export function HelpPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Panel className="w-full max-w-2xl">
        <PanelHeader>Help</PanelHeader>
        <PanelContent>
          <p className="text-gray-500">Help is not wired in this build.</p>
        </PanelContent>
      </Panel>
    </div>
  );
}
