"use client";

import { type ComponentProps, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import { usePanelContext } from "./panel-context";

/** Props for panel description. */
export interface PanelDescriptionProps extends ComponentProps<"p"> {}

/**
 * Paragraph description. Direct child trees are wired to the Panel root on the server and client.
 * A description created inside an opaque wrapper registers after client render; for SSR, give it a
 * stable id and pass that id through Panel aria-describedby.
 */
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
