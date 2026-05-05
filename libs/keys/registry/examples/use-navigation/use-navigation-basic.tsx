"use client"

import { useRef } from "react"
import { useNavigation } from "@diffgazer/keys"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Kbd } from "@/components/ui/kbd"

const items = ["Apple", "Banana", "Cherry", "Date", "Elderberry"]

export default function UseNavigationBasic() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { isHighlighted, onKeyDown } = useNavigation({
    containerRef,
    role: "option",
    wrap: true,
    onSelect: (value) => alert(`Selected: ${value}`),
  })

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle as="h3">Fruit Picker</CardTitle>
        <p className="text-xs text-muted-foreground">
          <Kbd size="sm">↑</Kbd> <Kbd size="sm">↓</Kbd> navigate
          {" "}<Kbd size="sm">Enter</Kbd> select
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={containerRef}
          onKeyDown={onKeyDown}
          tabIndex={0}
          role="listbox"
          aria-label="Fruits"
          className="focus:outline-none"
        >
          {items.map((item) => (
            <div
              key={item}
              role="option"
              aria-selected={isHighlighted(item)}
              data-value={item}
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
