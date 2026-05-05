"use client"

import { useNavigation } from "@diffgazer/keys"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { useRef, useState } from "react"

const sections = [
  { value: "overview", label: "Overview", content: "System health: all services operational." },
  { value: "metrics", label: "Metrics", content: "CPU: 42% | Memory: 3.2GB / 8GB | Disk: 67%" },
  { value: "logs", label: "Logs", content: "[12:01] INFO Request handled in 23ms\n[12:02] WARN Connection pool at 80%" },
  { value: "alerts", label: "Alerts", content: "1 active alert: disk usage above threshold." },
]

export default function TabsKeyboard() {
  const [value, setValue] = useState("overview")
  const containerRef = useRef<HTMLDivElement>(null)

  const { isHighlighted, onKeyDown } = useNavigation({
    containerRef,
    role: "option",
    orientation: "vertical",
    wrap: true,
    moveFocus: true,
    onSelect: (v) => setValue(v),
  })

  return (
    <div ref={containerRef} onKeyDown={onKeyDown}>
      <Tabs value={value} onValueChange={setValue}>
        <TabsList>
          {sections.map((s) => (
            <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
          ))}
        </TabsList>
        {sections.map((s) => (
          <TabsContent key={s.value} value={s.value}>
            <div
              role="option"
              data-value={s.value}
              tabIndex={0}
              className={`border border-border p-4 text-sm font-mono ${
                isHighlighted(s.value) ? "border-primary" : "text-muted-foreground"
              }`}
            >
              {s.content}
            </div>
          </TabsContent>
        ))}
      </Tabs>
      <p className="text-xs text-muted-foreground mt-2">
        ←→ switch tabs · ↑↓ move between tab list and content
      </p>
    </div>
  )
}
