"use client";

import { toast, Toaster } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"

export default function ToastVariants() {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            toast("Branch merged", {
              tone: "success",
              variant: "hud",
              message: "main · 2 files",
            })
          }
        >
          HUD pill
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            toast("Patch applied", {
              tone: "success",
              variant: "card",
              message: "Modified 2 files in src/auth/.",
            })
          }
        >
          Card (default)
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            toast("Stale artifacts", {
              tone: "warning",
              variant: "viewfinder",
              message: "Run pnpm prepare:artifacts before validating.",
            })
          }
        >
          Viewfinder
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            toast("Synced", {
              tone: "info",
              variant: "countdown",
              message: "Synced 12 files from origin.",
              duration: 5000,
            })
          }
        >
          Countdown
        </Button>
      </div>
      <Toaster />
    </>
  )
}
