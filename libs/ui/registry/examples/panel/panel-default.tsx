import { Panel, PanelHeader, PanelContent, PanelFooter } from "@/components/ui/panel"

export default function PanelDefault() {
  return (
    <Panel>
      <PanelHeader>Review Summary</PanelHeader>
      <PanelContent>
        <p className="text-sm text-foreground">
          3 files changed, 12 additions, 4 deletions. All checks passed.
        </p>
      </PanelContent>
      <PanelFooter>
        <span className="text-xs text-muted-foreground">Last updated: just now</span>
      </PanelFooter>
    </Panel>
  )
}
