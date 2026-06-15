"use client";

import { Children, type ComponentProps, isValidElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PanelDescription } from "./panel-description";
import { PanelTitle } from "./panel-title";

/** Props for panel header. */
export interface PanelHeaderProps extends ComponentProps<"div"> {
  /** Toggle the 4px foreground marker bar. Use "none" for rail or custom layouts. */
  marker?: "bar" | "none";
}

/**
 * Compound header. Title and Description live in a left column; any other child (eyebrow span,
 * badge, button) lands in a right slot.
 */
export function PanelHeader({ className, children, marker = "bar", ...props }: PanelHeaderProps) {
  const { bodyChildren, endChildren } = partitionHeaderChildren(children);
  const hasEnd = endChildren.length > 0;

  return (
    <div {...props} data-slot="panel-header" data-marker={marker} className={cn(className)}>
      <div data-slot="panel-header-body">{bodyChildren}</div>
      {hasEnd ? <div data-slot="panel-header-end">{endChildren}</div> : null}
    </div>
  );
}

function isBodyChild(child: ReactNode): boolean {
  if (!isValidElement(child)) return false;
  return child.type === PanelTitle || child.type === PanelDescription;
}

function partitionHeaderChildren(children: ReactNode): {
  bodyChildren: ReactNode[];
  endChildren: ReactNode[];
} {
  const bodyChildren: ReactNode[] = [];
  const endChildren: ReactNode[] = [];
  for (const child of Children.toArray(children)) {
    if (isBodyChild(child)) bodyChildren.push(child);
    else endChildren.push(child);
  }
  return { bodyChildren, endChildren };
}
