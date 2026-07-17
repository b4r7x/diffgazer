"use client";

import { type ComponentProps, type KeyboardEvent, useRef } from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useNavigation } from "@/hooks/use-navigation";
import { cn } from "@/lib/utils";
import { useSidebar } from "./sidebar-context";

/** Props for sidebar content. */
export interface SidebarContentProps extends ComponentProps<"div"> {}

/** Scrollable middle area. */
export function SidebarContent({
  ref,
  children,
  className,
  onKeyDown,
  inert,
  ...props
}: SidebarContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(containerRef, ref);
  const { state, contentId } = useSidebar();
  const hidden = state === "hidden";
  const ariaHidden = hidden ? true : props["aria-hidden"];

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "button",
    orientation: "vertical",
    wrap: true,
    moveFocus: true,
    scopeToContainer: true,
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (!e.defaultPrevented) navKeyDown(e);
  };

  return (
    <div
      {...props}
      ref={composedRef}
      id={props.id ?? contentId}
      aria-hidden={ariaHidden}
      inert={hidden || inert || undefined}
      hidden={hidden || props.hidden || undefined}
      data-state={state}
      className={cn(
        "flex-1 overflow-y-auto p-4",
        // Rail mode: zero horizontal padding so items center inside the 48px
        // rail. Vertical padding stays so the first/last items breathe.
        "group-data-[state=rail]/sidebar:px-0",
        className,
      )}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
