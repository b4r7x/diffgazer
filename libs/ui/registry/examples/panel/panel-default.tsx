import { Panel } from "@/components/ui/panel";

export default function PanelDefault() {
  return (
    <Panel>
      <Panel.Header>
        <Panel.Title>Repository</Panel.Title>
        <Panel.Description>diffgazer-workspace · last synced 4 minutes ago</Panel.Description>
      </Panel.Header>
      <Panel.Content spacing="none">
        <Panel.Row label="Branch" value="main" />
        <Panel.Row label="Commit" value="a1b2c3d" />
        <Panel.Row label="Author" value="developer@example.com" />
      </Panel.Content>
    </Panel>
  );
}
