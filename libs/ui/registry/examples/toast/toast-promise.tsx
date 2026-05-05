"use client";

import { toast, Toaster } from "@/components/ui/toast"
import { Button } from "@/components/ui/button"

function simulateAsync(shouldFail = false): Promise<{ count: number }> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) reject(new Error("Network error"));
      else resolve({ count: 12 });
    }, 2000);
  });
}

export default function ToastPromise() {
  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={() =>
            toast.promise(simulateAsync(), {
              loading: "Analyzing files...",
              success: (data) => `Analysis complete: ${data.count} files`,
              error: "Analysis failed",
            })
          }
        >
          Promise (Success)
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={() =>
            toast.promise(simulateAsync(true), {
              loading: "Analyzing files...",
              success: "Done",
              error: (err) => err instanceof Error ? err.message : "Unknown error",
            })
          }
        >
          Promise (Error)
        </Button>
      </div>
      <Toaster />
    </>
  )
}
