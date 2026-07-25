"use client";

import { useState } from "react";
import { Chevron } from "@/components/ui/icons";

export default function ChevronAnimated() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-fit items-center gap-2 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        <Chevron open={open} />
        <span>Click to toggle ({open ? "open" : "closed"})</span>
      </button>

      {/* Static pair: the rotation contract is verifiable without interacting. */}
      <div className="flex items-center gap-6 text-muted-foreground">
        <div className="flex items-center gap-2">
          <Chevron />
          <span className="text-xs font-mono">open={"{false}"} — points right</span>
        </div>
        <div className="flex items-center gap-2">
          <Chevron open />
          <span className="text-xs font-mono">open — rotated 90°</span>
        </div>
      </div>

      <div className="flex items-center gap-6 text-muted-foreground">
        <div className="flex items-center gap-2">
          <Chevron open={open} size="sm" />
          <span className="text-xs font-mono">sm · 12px</span>
        </div>
        <div className="flex items-center gap-2">
          <Chevron open={open} size="md" />
          <span className="text-xs font-mono">md · 16px</span>
        </div>
        <div className="flex items-center gap-2">
          <Chevron open={open} size="lg" />
          <span className="text-xs font-mono">lg · 20px</span>
        </div>
      </div>
    </div>
  );
}
