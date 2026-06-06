import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const sections = [
  { value: "overview", label: "Overview", content: "System health: all services operational." },
  { value: "metrics", label: "Metrics", content: "CPU: 42% | Memory: 3.2GB / 8GB | Disk: 67%" },
  { value: "logs", label: "Logs", content: "[12:01] INFO Request handled in 23ms\n[12:02] WARN Connection pool at 80%" },
  { value: "alerts", label: "Alerts", content: "1 active alert: disk usage above threshold." },
]

export default function TabsKeyboard() {
  return (
    <Tabs defaultValue="overview" activationMode="manual">
      <TabsList>
        {sections.map((section) => (
          <TabsTrigger key={section.value} value={section.value}>{section.label}</TabsTrigger>
        ))}
      </TabsList>
      {sections.map((section) => (
        <TabsContent key={section.value} value={section.value}>
          <div className="border border-border p-4 text-sm font-mono text-muted-foreground">
            {section.content}
          </div>
        </TabsContent>
      ))}
    </Tabs>
  )
}
