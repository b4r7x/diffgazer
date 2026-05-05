"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CommandPaletteGroupProps {
  heading: string;
  children: ReactNode;
  className?: string;
}

export function CommandPaletteGroup({ heading, children, className }: CommandPaletteGroupProps) {
  const headingId = useId();
  return (
    <div role="group" aria-labelledby={headingId} className={cn("hidden has-[[role=option]]:block", className)}>
      <div id={headingId} className="px-2 py-1.5 text-[10px] uppercase font-bold text-muted-foreground/70 tracking-wider">{heading}</div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
