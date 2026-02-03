import { Panel, PanelContent, PanelHeader } from "@/components/ui";

export function ReviewPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Panel className="w-full max-w-2xl">
        <PanelHeader>Review</PanelHeader>
        <PanelContent>
          <p className="text-gray-500">
            Review flow is not wired in this build.
          </p>
        </PanelContent>
      </Panel>
    </div>
  );
}
