import { Panel } from "@/components/ui/panel";

export default function PanelFocused() {
  return (
    <div className="grid gap-6 sm:grid-cols-2">
      <Panel>
        <Panel.Header>
          <Panel.Title as="h3">Resting</Panel.Title>
          <Panel.Description>Inactive pane. Frame chrome only.</Panel.Description>
        </Panel.Header>
        <Panel.Content spacing="none">
          <Panel.Row label="Branch" value="main" />
          <Panel.Row label="Commit" value="a1b2c3d" />
        </Panel.Content>
      </Panel>

      <Panel focused>
        <Panel.Header>
          <Panel.Title as="h3">Focused</Panel.Title>
          <Panel.Description>Active pane. Corner brackets in --ring.</Panel.Description>
        </Panel.Header>
        <Panel.Content spacing="none">
          <Panel.Row label="Branch" value="main" />
          <Panel.Row label="Commit" value="a1b2c3d" />
        </Panel.Content>
      </Panel>

      <Panel frame="viewfinder">
        <Panel.Header>
          <Panel.Title as="h3">Viewfinder resting</Panel.Title>
          <Panel.Description>16px brackets in --border-strong.</Panel.Description>
        </Panel.Header>
        <Panel.Content spacing="none">
          <Panel.Row label="Frame" value="viewfinder" />
        </Panel.Content>
      </Panel>

      <Panel frame="viewfinder" focused>
        <Panel.Header>
          <Panel.Title as="h3">Viewfinder focused</Panel.Title>
          <Panel.Description>28px brackets in --ring.</Panel.Description>
        </Panel.Header>
        <Panel.Content spacing="none">
          <Panel.Row label="Frame" value="viewfinder" />
        </Panel.Content>
      </Panel>
    </div>
  );
}
