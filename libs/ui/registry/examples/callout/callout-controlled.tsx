"use client"

import { useState } from "react"
import { Callout } from "@/components/ui/callout"

export default function CalloutControlled() {
  const [open, setOpen] = useState(true)

  return (
    <div className="flex flex-col gap-4">
      <Callout tone="warning" open={open} onOpenChange={setOpen}>
        <Callout.Icon />
        <Callout.Title>Controlled Callout</Callout.Title>
        <Callout.Content>Dismiss this callout, then use the button below to bring it back.</Callout.Content>
        <Callout.Dismiss />
      </Callout>

      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          [ show callout ]
        </button>
      )}
    </div>
  )
}
