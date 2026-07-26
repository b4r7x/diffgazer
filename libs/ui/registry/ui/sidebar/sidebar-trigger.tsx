"use client";

import type { ButtonHTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";

export interface SidebarTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLButtonElement>;
}

/**
 * Toggle button. Desktop cycles open ↔ rail; mobile opens and closes the sheet.
 * On coarse pointers the button grows to a 44px square, so host it in a row that can be at least
 * that tall (SidebarHeader's `min-h-11` is exactly that).
 */
export function SidebarTrigger({
  ref,
  className,
  onClick,
  children,
  "aria-label": ariaLabel,
  ...props
}: SidebarTriggerProps) {
  const { state, isMobile, openMobile, contentId, toggleSidebar } = useSidebar();
  const isOpen = isMobile ? openMobile : state === "open";
  const visualState: "open" | "collapsed" = isOpen ? "open" : "collapsed";
  let labelDefault = isOpen ? "Collapse sidebar" : "Expand sidebar";
  if (isMobile) {
    labelDefault = isOpen ? "Close navigation" : "Open navigation";
  }

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    toggleSidebar();
  };

  return (
    <button
      {...props}
      ref={ref}
      type="button"
      aria-controls={props["aria-controls"] ?? contentId}
      aria-expanded={isOpen}
      aria-label={ariaLabel ?? labelDefault}
      data-state={visualState}
      className={cn(
        "inline-flex min-h-6 min-w-6 items-center justify-center font-mono",
        "pointer-coarse:min-h-11 pointer-coarse:min-w-11",
        className,
      )}
      onClick={handleClick}
    >
      {children ?? <span aria-hidden="true">{isOpen ? "[×]" : "[≡]"}</span>}
    </button>
  );
}
