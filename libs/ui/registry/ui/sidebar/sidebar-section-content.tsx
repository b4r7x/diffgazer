"use client";

import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";
import { useSidebarChrome } from "./sidebar-context";
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
  const { variant } = useSidebarChrome();
  const isTree = variant === "tree";
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
        className={cn(
          "flex flex-col",
          isTree &&
            "ml-1.5 gap-1 border-l border-border pl-2 group-data-[state=rail]/sidebar:ml-0 group-data-[state=rail]/sidebar:border-l-0 group-data-[state=rail]/sidebar:pl-0",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
