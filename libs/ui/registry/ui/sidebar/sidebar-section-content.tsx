"use client";

import type { ComponentProps } from "react";
import { useSidebarSectionContext } from "./sidebar-section-context";

/** Props for sidebar section content. */
export interface SidebarSectionContentProps extends ComponentProps<"div"> {}

/**
 * Panel slot for collapsible sections. Wraps items so the title's aria-controls targets a
 * single id.
 *
 * No role="region" and no opt-in for one: a sidebar holds many short navigation sections, the
 * case AccordionContent's and StepperContent's `region` docs call out as landmark noise. The
 * sidebar is already inside a nav landmark.
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
      className={className}
    >
      <div data-slot="sidebar-section-content-inner" className="flex flex-col">
        {children}
      </div>
    </div>
  );
}
