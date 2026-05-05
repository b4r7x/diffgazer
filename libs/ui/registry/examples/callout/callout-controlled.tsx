"use client"

import { useState } from "react"
import { Callout, CalloutIcon, CalloutTitle, CalloutContent, CalloutDismiss } from "@/components/ui/callout"

export default function CalloutControlled() {
  const [visible, setVisible] = useState(true)

  return (
    <div className="flex flex-col gap-4">
      <Callout variant="warning" visible={visible} onVisibleChange={setVisible}>
        <CalloutIcon />
        <CalloutTitle>Controlled Callout</CalloutTitle>
        <CalloutContent>Dismiss this callout, then use the button below to bring it back.</CalloutContent>
        <CalloutDismiss />
      </Callout>

      {!visible && (
        <button
          type="button"
          onClick={() => setVisible(true)}
          className="font-mono text-sm text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          [ show callout ]
        </button>
      )}
    </div>
  )
}
