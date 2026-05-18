"use client";

import { useRef, useState } from "react";
import { FloatingPanel } from "@/components/ui/floating-panel";

export default function FloatingPanelDefaultExample() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <div className="flex items-center gap-4">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="border border-foreground/30 px-3 py-1 font-mono text-sm"
      >
        {open ? "close" : "open panel"}
      </button>

      <FloatingPanel
        open={open}
        triggerRef={triggerRef}
        role="dialog"
        aria-label="Quick info"
        onExitComplete={() => undefined}
        className="border border-border bg-background p-3 font-mono text-xs text-foreground shadow-md"
      >
        Anchored panel content.
        <button
          type="button"
          className="mt-2 block border border-foreground/30 px-2 py-0.5 text-xs"
          onClick={() => setOpen(false)}
        >
          dismiss
        </button>
      </FloatingPanel>
    </div>
  );
}
