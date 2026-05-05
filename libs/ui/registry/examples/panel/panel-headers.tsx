import { Panel, PanelHeader, PanelContent, PanelFooter } from "@/components/ui/panel"

export default function PanelHeaders() {
  return (
    <div className="flex flex-col gap-6">
      <Panel>
        <PanelHeader variant="default">Default (Card-like)</PanelHeader>
        <PanelContent>Content area</PanelContent>
      </Panel>
      <Panel>
        <PanelHeader variant="terminal">Terminal Header</PanelHeader>
        <PanelContent>Content area</PanelContent>
      </Panel>
      <Panel>
        <PanelHeader variant="subtle">Subtle Header</PanelHeader>
        <PanelContent>Content area</PanelContent>
      </Panel>
      <Panel>
        <PanelHeader>
          <span>Progress</span>
          <span className="text-success">3/5</span>
        </PanelHeader>
        <PanelContent>Header with value display</PanelContent>
      </Panel>
      <Panel>
        <PanelHeader>
          <span>Status</span>
          <span className="bg-success/10 text-success border border-success px-2 py-0.5 text-xs font-bold tracking-wider rounded-sm">PASS</span>
        </PanelHeader>
        <PanelContent>Header with success badge value</PanelContent>
        <PanelFooter>
          <span className="text-xs text-muted-foreground">Footer metadata</span>
        </PanelFooter>
      </Panel>
    </div>
  )
}
