import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export default function TabsDefault() {
  return (
    <Tabs defaultValue="preview">
      <TabsList>
        <TabsTrigger value="preview">Preview</TabsTrigger>
        <TabsTrigger value="code">Code</TabsTrigger>
        <TabsTrigger value="tests">Tests</TabsTrigger>
      </TabsList>
      <TabsContent value="preview">
        <div className="border border-border p-4 text-sm">
          Live preview of the component renders here.
        </div>
      </TabsContent>
      <TabsContent value="code">
        <div className="border border-border p-4 text-sm font-mono text-muted-foreground">
          Source code displayed here with syntax highlighting.
        </div>
      </TabsContent>
      <TabsContent value="tests">
        <div className="border border-border p-4 text-sm text-success">
          All 12 tests passing.
        </div>
      </TabsContent>
    </Tabs>
  )
}
