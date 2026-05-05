import { Panel, PanelHeader, PanelContent, PanelFooter } from "@/components/ui/panel"

export default function PanelComposed() {
  return (
    <Panel>
      <PanelHeader>
        <span>Repository</span>
        <span className="text-muted-foreground">main</span>
      </PanelHeader>
      <PanelContent spacing="sm">
        <div className="flex justify-between text-xs py-1 border-b border-border">
          <span className="text-muted-foreground">Branch</span>
          <span className="text-foreground font-bold">main</span>
        </div>
        <div className="flex justify-between text-xs py-1 border-b border-border">
          <span className="text-muted-foreground">Commit</span>
          <span className="font-mono">a1b2c3d</span>
        </div>
        <div className="flex justify-between text-xs py-1 border-b border-border">
          <span className="text-muted-foreground">Author</span>
          <span>developer@example.com</span>
        </div>
        <div className="flex justify-between text-xs py-1">
          <span className="text-muted-foreground">Files changed</span>
          <span className="text-success font-bold">7</span>
        </div>
      </PanelContent>
      <PanelFooter>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Repository health</span>
          <span className="text-success font-bold">stable</span>
        </div>
      </PanelFooter>
    </Panel>
  )
}
