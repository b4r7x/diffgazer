import { Button } from "@/components/ui/button/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input/input"
import { Callout } from "@/components/ui/callout"
import { Panel, PanelHeader, PanelContent } from "@/components/ui/panel"

export function PreviewPanel() {
  return (
    <div className="bg-background bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:20px_20px] p-4 space-y-4 border border-border">
      <div className="flex flex-wrap gap-2">
        <Button variant="primary">Primary</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
        <Button variant="outline">Outline</Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="info">info</Badge>
        <Badge variant="success">success</Badge>
        <Badge variant="warning">warning</Badge>
        <Badge variant="error">error</Badge>
      </div>

      <Input placeholder="Type something..." />

      <Callout variant="info">This is an informational callout.</Callout>
      <Callout variant="warning">This is a warning callout.</Callout>

      <Panel>
        <PanelHeader>Panel Title</PanelHeader>
        <PanelContent>
          <p className="text-sm text-foreground">Panel content with theme variables applied.</p>
        </PanelContent>
      </Panel>
    </div>
  )
}
