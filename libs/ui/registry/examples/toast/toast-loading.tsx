"use client";

import { toast, Toaster } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"

export default function ToastLoading() {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => toast.loading("Processing...", { message: "This may take a moment." })}
        >
          Show Loading Toast
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => toast.dismiss()}
        >
          Dismiss All
        </Button>
      </div>
      <Toaster />
    </>
  )
}
