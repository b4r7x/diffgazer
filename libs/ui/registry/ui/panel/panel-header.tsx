"use client";

import { Children, isValidElement, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PanelTitle } from "./panel-title";
import { PanelDescription } from "./panel-description";

export interface PanelHeaderProps extends HTMLAttributes<HTMLDivElement> {
  /**
   * "bar" renders a 4px foreground accent bar to the left of the title and
   * description column, matching Dialog's `marker="bar"`. Color follows
   * `--panel-tone` (tone-tinted when the panel has a tone).
   * "none" suppresses the bar; useful for `frame="rail"` (the rail is the
   * marker) or custom header layouts.
   */
  marker?: "bar" | "none";
}

/**
 * Compound header. Title and Description go in a left column; any other
 * sibling (eyebrow tag, badge, button) lands in a right slot, vertically
 * centered against the title baseline. The marker bar spans the full
 * header height via `align-self: stretch`.
 */
export function PanelHeader({
  className,
  children,
  marker = "bar",
  ...props
}: PanelHeaderProps) {
  const { bodyChildren, endChildren } = partitionHeaderChildren(children);
  const hasEnd = endChildren.length > 0;

  return (
    <div
      {...props}
      data-slot="panel-header"
      data-marker={marker}
      className={cn(className)}
    >
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
