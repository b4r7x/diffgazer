"use client"

import { useState } from "react"
import { useScrollLock } from "@diffgazer/keys"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function Overlay({ onClose }: { onClose: () => void }) {
  useScrollLock()

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <Card size="sm" variant="panel">
          <CardHeader>
            <CardTitle as="h3">Overlay</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Background scroll is locked while this overlay is visible.
            </p>
          </CardContent>
          <CardFooter>
            <Button variant="secondary" onClick={onClose}>Close</Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}

export default function UseScrollLockBasic() {
  const [open, setOpen] = useState(false)

  return (
    <div className="h-[500px]">
      <div className="flex items-center gap-3 mb-3">
        <Button variant="secondary" onClick={() => setOpen(true)}>
          Show Overlay
        </Button>
        <Badge variant={open ? "warning" : "neutral"} dot>
          {open ? "Scroll locked" : "Scroll unlocked"}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">
        Scroll down to see content. Opening the overlay locks scroll.
      </p>
      {open && <Overlay onClose={() => setOpen(false)} />}
    </div>
  )
}
