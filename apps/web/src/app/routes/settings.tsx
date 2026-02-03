import { Panel, PanelContent, PanelHeader } from "@/components/ui";

export function SettingsHubPage() {
  return (
    <div className="flex-1 flex items-center justify-center p-6">
      <Panel className="w-full max-w-2xl">
        <PanelHeader>Settings</PanelHeader>
        <PanelContent>
          <p className="text-gray-500">
            Settings hub is not wired in this build.
          </p>
        </PanelContent>
      </Panel>
    </div>
  );
}
