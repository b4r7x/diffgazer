"use client";

import { type ComponentProps, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import { usePanelContext } from "./panel-context";

/** Props for panel description. */
export interface PanelDescriptionProps extends ComponentProps<"p"> {}

/** Paragraph description. Auto-wires aria-describedby on the Panel root. */
export function PanelDescription({ className, id, ...props }: PanelDescriptionProps) {
  const { descriptionId, registerDescription, unregisterDescription } = usePanelContext();
  const resolvedId = id ?? descriptionId;

  useLayoutEffect(() => {
    registerDescription(resolvedId);
    return () => unregisterDescription(resolvedId);
  }, [resolvedId, registerDescription, unregisterDescription]);

  return (
    <p
      {...props}
      data-slot="panel-description"
      id={resolvedId}
      className={cn("m-0 text-xs leading-normal text-foreground/70", className)}
    />
  );
}
