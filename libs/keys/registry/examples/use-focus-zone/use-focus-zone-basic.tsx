"use client"

import { useRef } from "react"
import { KeyboardProvider, useFocusZone, useScopedNavigation } from "@diffgazer/keys"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Kbd } from "@/components/ui/kbd"

type Zone = "sidebar" | "main"

function Layout() {
  const { zone, inZone } = useFocusZone<Zone>({
    initial: "sidebar",
    zones: ["sidebar", "main"],
    transitions: ({ zone, key }) => {
      if (zone === "sidebar" && key === "ArrowRight") return "main"
      if (zone === "main" && key === "ArrowLeft") return "sidebar"
      return null
    },
  })

  const sidebarItems = ["Dashboard", "Settings", "Profile"]
  const mainItems = ["Item A", "Item B", "Item C", "Item D"]

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={zone === "sidebar" ? "info" : "neutral"} dot>
          Sidebar
        </Badge>
        <Badge variant={zone === "main" ? "info" : "neutral"} dot>
          Main
        </Badge>
        <span className="text-xs text-muted-foreground ml-2">
          <Kbd size="sm">←</Kbd> <Kbd size="sm">→</Kbd> switch zones
        </span>
      </div>
      <div className="flex gap-4">
        <Pane
          title="Sidebar"
          items={sidebarItems}
          active={inZone("sidebar")}
          enabled={zone === "sidebar"}
        />
        <Pane
          title="Main"
          items={mainItems}
          active={inZone("main")}
          enabled={zone === "main"}
        />
      </div>
    </div>
  )
}

function Pane({
  title,
  items,
  active,
  enabled,
}: {
  title: string
  items: string[]
  active: boolean
  enabled: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  const { isHighlighted } = useScopedNavigation({
    containerRef,
    role: "option",
    wrap: true,
    enabled,
  })

  return (
    <Card className={`min-w-40 ${active ? "border-primary" : ""}`}>
      <CardHeader>
        <CardTitle as="h4">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={containerRef} role="listbox">
          {items.map((item) => (
            <div
              key={item}
              role="option"
              data-value={item}
              aria-selected={isHighlighted(item)}
              className={`px-4 py-2 text-sm ${isHighlighted(item) ? "bg-foreground text-background font-bold" : "text-muted-foreground"}`}
            >
              {item}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function UseFocusZoneBasic() {
  return (
    <KeyboardProvider>
      <Layout />
    </KeyboardProvider>
  )
}
