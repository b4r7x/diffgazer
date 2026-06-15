"use client";

import { type ComponentProps, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import { usePanelContext } from "./panel-context";

/** Props for panel title. */
export interface PanelTitleProps extends ComponentProps<"h2"> {
  /** Heading level. Defaults to h2, matching Dialog. */
  as?: "h2" | "h3" | "h4" | "h5" | "h6";
}

/**
 * Real heading (h2 by default, configurable via `as`). Auto-wires aria-labelledby on the Panel
 * root.
 */
export function PanelTitle({ children, className, as: Tag = "h2", id, ...props }: PanelTitleProps) {
  const { titleId, registerTitle, unregisterTitle } = usePanelContext();
  const resolvedId = id ?? titleId;

  useLayoutEffect(() => {
    registerTitle(resolvedId);
    return () => unregisterTitle(resolvedId);
  }, [resolvedId, registerTitle, unregisterTitle]);

  return (
    <Tag
      {...props}
      id={resolvedId}
      data-slot="panel-title"
      className={cn("m-0 text-sm font-bold leading-tight text-foreground", className)}
    >
      {children}
    </Tag>
  );
}
