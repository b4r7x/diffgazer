import { Panel, PanelContent, PanelHeader } from "@/components/ui";

export function HistoryPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Panel className="w-full max-w-2xl">
        <PanelHeader>History</PanelHeader>
        <PanelContent>
          <p className="text-gray-500">
            History page is not wired in this build.
          </p>
        </PanelContent>
      </Panel>
    </div>
  );
}
