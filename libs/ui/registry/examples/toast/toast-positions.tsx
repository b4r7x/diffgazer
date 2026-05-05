"use client";

import { useState } from "react"
import { toast, Toaster } from "@/components/ui/toast"
import type { ToastPosition } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"
import { ToggleGroup } from "@/components/ui/toggle-group"

export default function ToastPositions() {
  const [position, setPosition] = useState<string | null>("bottom-right")
  return (
    <div className="flex flex-col gap-4">
      <ToggleGroup value={position} onChange={setPosition}>
        <ToggleGroup.Item value="top-left">Top Left</ToggleGroup.Item>
        <ToggleGroup.Item value="top-center">Top Center</ToggleGroup.Item>
        <ToggleGroup.Item value="top-right">Top Right</ToggleGroup.Item>
        <ToggleGroup.Item value="bottom-left">Bottom Left</ToggleGroup.Item>
        <ToggleGroup.Item value="bottom-center">Bottom Center</ToggleGroup.Item>
        <ToggleGroup.Item value="bottom-right">Bottom Right</ToggleGroup.Item>
      </ToggleGroup>
      <Button
        variant="primary"
        size="sm"
        onClick={() =>
          toast.info("Notification", { message: "Check the selected corner." })
        }
      >
        Show Toast
      </Button>
      <Toaster position={(position ?? "bottom-right") as ToastPosition} />
    </div>
  )
}
