"use client";

import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";

export interface SidebarTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  ref?: Ref<HTMLButtonElement>;
}

export function SidebarTrigger({ ref, className, onClick, children, "aria-label": ariaLabel, ...props }: SidebarTriggerProps) {
  const { collapsed, toggleSidebar } = useSidebar();

  return (
    <button
      {...props}
      ref={ref}
      type="button"
      aria-expanded={!collapsed}
      aria-label={ariaLabel ?? (collapsed ? "Expand sidebar" : "Collapse sidebar")}
      className={cn("inline-flex items-center justify-center", className)}
      onClick={(e) => {
        toggleSidebar();
        onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}
