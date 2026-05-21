"use client";

import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";
import { useSidebarSectionContext } from "./sidebar-section-context";

export interface SidebarSectionContentProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

/**
 * Panel slot for collapsible sections. Wraps the items so the section title's
 * disclosure button can reference a single `aria-controls` target.
 *
 * Animation: the element stays in the DOM at all times so the `grid-template-rows`
 * 0fr → 1fr transition (defined in `shared/sidebar.css`) can tween height; the
 * inner wrapper carries `min-height: 0; overflow: hidden` so the grid can
 * squeeze the row to zero. When closed, `inert` removes descendants from the
 * tab order and `aria-hidden` removes them from the accessibility tree. For
 * non-collapsible sections this is a no-op wrapper and can be omitted.
 */
export function SidebarSectionContent({
  ref,
  className,
  children,
  ...rest
}: SidebarSectionContentProps) {
  const { open, panelId, collapsible } = useSidebarSectionContext();
  const isClosed = collapsible && !open;

  return (
    <div
      {...rest}
      ref={ref}
      id={panelId}
      data-slot="sidebar-section-content"
      data-state={open ? "open" : "closed"}
      aria-hidden={isClosed || undefined}
      inert={isClosed || undefined}
    >
      <div
        data-slot="sidebar-section-content-inner"
        className={cn("flex flex-col", className)}
      >
        {children}
      </div>
    </div>
  );
}
