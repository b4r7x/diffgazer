"use client";

import { Button } from "@/components/ui/button";
import { Toaster, toast } from "@/components/ui/toast";

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
        <Button variant="ghost" size="sm" onClick={() => toast.dismiss()}>
          Dismiss All
        </Button>
      </div>
      <Toaster />
    </>
  );
}
