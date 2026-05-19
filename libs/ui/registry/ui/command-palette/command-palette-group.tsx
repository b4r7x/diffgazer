"use client";

import { useId, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CommandPaletteGroupProps {
  heading: ReactNode;
  children: ReactNode;
  className?: string;
}

export function CommandPaletteGroup({ heading, children, className }: CommandPaletteGroupProps) {
  const headingId = useId();
  return (
    <div
      role="group"
      aria-labelledby={headingId}
      data-slot="command-palette-group"
      className={cn("hidden has-[[role=option]]:block", className)}
    >
      <div id={headingId} data-slot="command-palette-group-heading">{heading}</div>
      <div>{children}</div>
    </div>
  );
}
