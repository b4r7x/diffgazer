"use client"

import { useState } from "react"
import { KeyboardProvider, useKey } from "@diffgazer/keys"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Kbd } from "@/components/ui/kbd"

function Counter() {
  const [count, setCount] = useState(0)

  useKey("ArrowUp", () => setCount((c) => c + 1))
  useKey("ArrowDown", () => setCount((c) => c - 1))
  useKey("Escape", () => setCount(0))

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle as="h3">Counter</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-2xl font-mono text-center">
          {count}
        </p>
        <Badge variant={count > 0 ? "success" : count < 0 ? "error" : "neutral"} dot>
          {count > 0 ? "Positive" : count < 0 ? "Negative" : "Zero"}
        </Badge>
        <p className="text-xs text-muted-foreground">
          <Kbd size="sm">↑</Kbd> increment
          {" "}<Kbd size="sm">↓</Kbd> decrement
          {" "}<Kbd size="sm">Esc</Kbd> reset
        </p>
      </CardContent>
    </Card>
  )
}

export default function UseKeyBasic() {
  return (
    <KeyboardProvider>
      <Counter />
    </KeyboardProvider>
  )
}
