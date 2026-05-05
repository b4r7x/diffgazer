"use client"

import { useState } from "react"
import { NavigationList } from "@/components/ui/navigation-list"

export default function NavigationListInteractive() {
  const [selected, setSelected] = useState<string>("src")

  const files = [
    { id: "src", name: "src/index.ts", badge: "M", variant: "warning" as const },
    { id: "test", name: "src/index.test.ts", badge: "A", variant: "success" as const },
    { id: "config", name: "tsconfig.json", badge: "M", variant: "warning" as const },
    { id: "readme", name: "README.md", badge: "D", variant: "error" as const },
  ]

  return (
    <NavigationList
      selectedId={selected}
      onSelect={setSelected}
      aria-label="Changed files"
    >
      {files.map((file) => (
        <NavigationList.Item
          key={file.id}
          id={file.id}
        >
          <NavigationList.Title>{file.name}</NavigationList.Title>
          <NavigationList.Meta>
            <NavigationList.Badge variant={file.variant}>{file.badge}</NavigationList.Badge>
          </NavigationList.Meta>
        </NavigationList.Item>
      ))}
    </NavigationList>
  )
}
