import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export default function TabsVertical() {
  return (
    <Tabs defaultValue="general" orientation="vertical">
      <div className="flex gap-4">
        <TabsList className="w-40 shrink-0">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="editor">Editor</TabsTrigger>
          <TabsTrigger value="keys">API Keys</TabsTrigger>
        </TabsList>
        <div className="flex-1">
          <TabsContent value="general" className="mt-0">
            <div className="border border-border p-4 text-sm">
              General settings: theme, language, notifications.
            </div>
          </TabsContent>
          <TabsContent value="editor" className="mt-0">
            <div className="border border-border p-4 text-sm">
              Editor preferences: font size, tab width, line numbers.
            </div>
          </TabsContent>
          <TabsContent value="keys" className="mt-0">
            <div className="border border-border p-4 text-sm">
              Manage your API keys for AI providers.
            </div>
          </TabsContent>
        </div>
      </div>
    </Tabs>
  )
}
