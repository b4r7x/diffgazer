"use client";

import { toast, Toaster } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"

export default function ToastActions() {
  return (
    <>
      <div className="flex flex-col gap-4">
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            toast.success("Review Submitted", {
              message: "Your code review has been submitted for 3 files.",
              action: <Button variant="ghost" size="sm">Undo</Button>,
            })
          }
        >
          Show with Action
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() =>
            toast.info("Analysis Complete", {
              message: "Found 5 suggestions and 2 warnings across 12 files.",
              duration: 8000,
            })
          }
        >
          Show with Custom Duration (8s)
        </Button>
      </div>
      <Toaster />
    </>
  )
}
