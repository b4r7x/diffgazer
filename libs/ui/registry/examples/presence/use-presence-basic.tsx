"use client";

import { useRef, useState } from "react";
import { usePresence } from "@/hooks/use-presence";

export default function UsePresenceBasicExample() {
  const [open, setOpen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { present } = usePresence({ open, ref: contentRef });

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-fit font-mono text-sm border border-border px-3 py-1.5 bg-background hover:bg-muted transition-colors"
      >
        {open ? "Hide" : "Show"}
      </button>

      {present && (
        <div
          ref={contentRef}
          data-state={open ? "open" : "closed"}
          className="w-48 border border-border bg-muted p-4 font-mono text-sm motion-safe:data-[state=open]:animate-[fade-in_0.15s_ease-out] motion-safe:data-[state=closed]:animate-[fade-out_0.15s_ease-in_forwards]"
        >
          Animated content
        </div>
      )}

      <span className="font-mono text-xs text-muted-foreground">
        open: {String(open)} · present: {String(present)}
      </span>
    </div>
  );
}
