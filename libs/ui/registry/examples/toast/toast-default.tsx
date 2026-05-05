"use client";

import { toast, Toaster } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"

export default function ToastDefault() {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() => toast.success("Saved", { message: "Changes saved successfully." })}
        >
          Success
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => toast.error("Error", { message: "Something went wrong." })}
        >
          Error
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => toast.warning("Warning", { message: "This action cannot be undone." })}
        >
          Warning
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toast.info("Info", { message: "A new version is available." })}
        >
          Info
        </Button>
      </div>
      <Toaster />
    </>
  )
}
