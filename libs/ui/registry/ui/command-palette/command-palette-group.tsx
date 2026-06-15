"use client";

import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

/** Props for command palette group. */
export interface CommandPaletteGroupProps {
  /** Group heading rendered above the items. */
  heading: ReactNode;
  /** Content rendered inside the component. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
}

/** Labeled group of items. */
export function CommandPaletteGroup({ heading, children, className }: CommandPaletteGroupProps) {
  const headingId = useId();
  return (
    // biome-ignore lint/a11y/useSemanticElements: role="group" labels a related set of command options; <fieldset> is for form controls and is not appropriate here.
    <div
      role="group"
      aria-labelledby={headingId}
      data-slot="command-palette-group"
      className={cn("hidden has-[[role=option]]:block", className)}
    >
      <div id={headingId} data-slot="command-palette-group-heading">
        {heading}
      </div>
      <div>{children}</div>
    </div>
  );
}
