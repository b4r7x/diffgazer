"use client";

import { type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { usePanelContext } from "./panel-context";

export interface PanelDescriptionProps extends HTMLAttributes<HTMLParagraphElement> {}

/**
 * Auto-wires `aria-describedby` on the Panel root. The root walks its children
 * at render time to detect `Panel.Description`, so this component just reads
 * the shared id from context and applies it to its rendered element.
 */
export function PanelDescription({ className, ...props }: PanelDescriptionProps) {
  const { descriptionId } = usePanelContext();

  return (
    <p
      {...props}
      data-slot="panel-description"
      id={descriptionId}
      className={cn("m-0 text-xs leading-normal text-foreground/70", className)}
    />
  );
}
