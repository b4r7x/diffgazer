import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";

export default function PanelComposed() {
  return (
    <Panel>
      <Panel.Header>
        <Panel.Title>Repository</Panel.Title>
        <Panel.Description>diffgazer-workspace · last synced 4 minutes ago</Panel.Description>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted">MAIN</span>
        <Button variant="ghost" size="sm">
          Open
        </Button>
      </Panel.Header>
      <Panel.Content spacing="none">
        <Panel.Row label="Branch" value="main" />
        <Panel.Row label="Commit" value="a1b2c3d" />
        <Panel.Row label="Author" value="developer@example.com" />
        <Panel.Row label="Files changed" value={<Badge variant="success">7 OK</Badge>} />
      </Panel.Content>
      <Panel.Footer>
        <span>Repository health</span>
        <Badge variant="success">stable</Badge>
      </Panel.Footer>
    </Panel>
  );
}
