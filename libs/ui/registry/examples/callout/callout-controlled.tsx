"use client"

import { useState } from "react"
import { Callout, CalloutIcon, CalloutTitle, CalloutContent, CalloutDismiss } from "@/components/ui/callout"

export default function CalloutControlled() {
  const [open, setOpen] = useState(true)

  return (
    <div className="flex flex-col gap-4">
      <Callout variant="warning" open={open} onOpenChange={setOpen}>
        <CalloutIcon />
        <CalloutTitle>Controlled Callout</CalloutTitle>
        <CalloutContent>Dismiss this callout, then use the button below to bring it back.</CalloutContent>
        <CalloutDismiss />
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
