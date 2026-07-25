"use client";

import { useEffect } from "react";
import { Toaster, toast } from "@/components/ui/toast";

export default function ToastStatic() {
  // Publishes one standing toast to the store on mount so this page shows a
  // real rendered toast instead of only trigger buttons. A non-finite duration
  // opts out of auto-dismissal; the close button still removes it.
  useEffect(() => {
    const id = toast.success("Patch applied", {
      message: "Modified 2 files in src/auth/.",
      duration: Number.POSITIVE_INFINITY,
    });
    return () => toast.dismiss(id);
  }, []);

  return (
    <>
      <p className="font-mono text-xs text-muted-foreground">
        Toasts render in a fixed-position region — look at the bottom-right corner of the page.
      </p>
      <Toaster />
    </>
  );
}
