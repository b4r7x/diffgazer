import { Panel } from "@/components/ui/panel";

export default function PanelReadout() {
  return (
    <div className="grid gap-8 sm:grid-cols-2">
      <Panel frame="viewfinder">
        <Panel.Label variant="readout">SETUP · 02/06 · PROVIDER</Panel.Label>
        <Panel.Content>
          <Panel.Row label="Provider" value="anthropic" />
        </Panel.Content>
      </Panel>

      <Panel frame="viewfinder" focused>
        <Panel.Label variant="readout">SETUP · 03/06 · API KEY</Panel.Label>
        <Panel.Content>
          <Panel.Row label="Key" value="sk-…f21a" />
        </Panel.Content>
      </Panel>

      <Panel>
        <Panel.Label>[ 01 / FS_TREE ]</Panel.Label>
        <Panel.Content>
          <Panel.Row label="Variant" value="border" />
        </Panel.Content>
      </Panel>

      <Panel>
        <Panel.Label variant="gap">[ 02 / DIFF ]</Panel.Label>
        <Panel.Content>
          <Panel.Row label="Variant" value="gap" />
        </Panel.Content>
      </Panel>
    </div>
  );
}
