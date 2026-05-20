import { Panel } from "@/components/ui/panel"

export default function PanelTones() {
  return (
    <div className="flex flex-col gap-6">
      <Panel tone="info">
        <Panel.Header>
          <Panel.Title>Info tone</Panel.Title>
          <Panel.Description>Border tinted with --info-border.</Panel.Description>
        </Panel.Header>
        <Panel.Content>
          <Panel.Row label="Status" value="informational" />
        </Panel.Content>
      </Panel>

      <Panel tone="warning">
        <Panel.Header>
          <Panel.Title>Warning tone</Panel.Title>
          <Panel.Description>Subtle visual flag — no role, no announcement.</Panel.Description>
        </Panel.Header>
        <Panel.Content>
          <Panel.Row label="Last sync" value="14d ago" />
        </Panel.Content>
      </Panel>

      <Panel tone="error">
        <Panel.Header>
          <Panel.Title>Error tone</Panel.Title>
          <Panel.Description>For real alerts (icon, role=alert, dismissable), use Callout.</Panel.Description>
        </Panel.Header>
        <Panel.Content>
          <Panel.Row label="Failures" value="3" />
        </Panel.Content>
      </Panel>

      <Panel tone="accent">
        <Panel.Header>
          <Panel.Title>Accent tone</Panel.Title>
          <Panel.Description>For featured / pinned cards.</Panel.Description>
        </Panel.Header>
        <Panel.Content>
          <Panel.Row label="Pinned" value="yes" />
        </Panel.Content>
      </Panel>
    </div>
  )
}
