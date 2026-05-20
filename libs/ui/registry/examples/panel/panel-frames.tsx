import { Panel } from "@/components/ui/panel"

export default function PanelFrames() {
  return (
    <div className="flex flex-col gap-6">
      <Panel frame="hairline">
        <Panel.Header>
          <Panel.Title>Hairline (default)</Panel.Title>
          <Panel.Description>Soft border with foreground marker bar.</Panel.Description>
        </Panel.Header>
        <Panel.Content>
          <Panel.Row label="Frame" value="hairline" />
        </Panel.Content>
      </Panel>

      <Panel frame="rail">
        <Panel.Header>
          <Panel.Title>Rail</Panel.Title>
          <Panel.Description>Inline-start rail. Lightest chrome.</Panel.Description>
        </Panel.Header>
        <Panel.Content>
          <Panel.Row label="Frame" value="rail" />
        </Panel.Content>
      </Panel>

      <Panel frame="viewfinder">
        <Panel.Header>
          <Panel.Title>Viewfinder</Panel.Title>
          <Panel.Description>Four corner brackets — Dialog-family parity.</Panel.Description>
        </Panel.Header>
        <Panel.Content>
          <Panel.Row label="Frame" value="viewfinder" />
        </Panel.Content>
      </Panel>

      <Panel frame="surface">
        <Panel.Header>
          <Panel.Title>Surface</Panel.Title>
          <Panel.Description>Linear-style elevated surface with inner top highlight.</Panel.Description>
        </Panel.Header>
        <Panel.Content>
          <Panel.Row label="Frame" value="surface" />
        </Panel.Content>
      </Panel>
    </div>
  )
}
