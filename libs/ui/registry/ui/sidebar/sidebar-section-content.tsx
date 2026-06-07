"use client";

import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";
import { useSidebarSectionContext } from "./sidebar-section-context";

export interface SidebarSectionContentProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

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
      <div data-slot="sidebar-section-content-inner" className={cn("flex flex-col", className)}>
        {children}
      </div>
    </div>
  );
}
