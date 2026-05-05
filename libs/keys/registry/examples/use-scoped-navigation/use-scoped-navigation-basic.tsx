"use client"

import { useRef, useState } from "react"
import { KeyboardProvider, useScope, useScopedNavigation } from "@diffgazer/keys"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Kbd } from "@/components/ui/kbd"

const commands = ["New File", "Open File", "Save", "Save As", "Close"]

function CommandPalette({ onClose }: { onClose: () => void }) {
  const listRef = useRef<HTMLDivElement>(null)

  useScope("command-palette")

  const { isHighlighted } = useScopedNavigation({
    containerRef: listRef,
    role: "option",
    wrap: true,
    onSelect: (value) => {
      alert(`Executed: ${value}`)
      onClose()
    },
  })

  return (
    <Card size="sm" className="mt-2">
      <CardHeader>
        <CardTitle as="h3">Command Palette</CardTitle>
        <p className="text-xs text-muted-foreground">
          <Kbd size="sm">↑</Kbd> <Kbd size="sm">↓</Kbd> navigate
          {" "}<Kbd size="sm">Enter</Kbd> execute
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div ref={listRef} role="listbox" tabIndex={0} className="focus:outline-none">
          {commands.map((cmd) => (
            <div
              key={cmd}
              role="option"
              data-value={cmd}
              aria-selected={isHighlighted(cmd)}
              className={`px-4 py-2 text-sm ${isHighlighted(cmd) ? "bg-foreground text-background font-bold" : "text-muted-foreground"}`}
            >
              {cmd}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function App() {
  const [open, setOpen] = useState(false)

  return (
    <div>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Open Command Palette
      </Button>
      {open && <CommandPalette onClose={() => setOpen(false)} />}
    </div>
  )
}

export default function UseScopedNavigationBasic() {
  return (
    <KeyboardProvider>
      <App />
    </KeyboardProvider>
  )
}
