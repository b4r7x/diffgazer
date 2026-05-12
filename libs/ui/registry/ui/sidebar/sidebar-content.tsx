"use client";

import { useRef, type HTMLAttributes, type KeyboardEvent, type Ref } from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { cn } from "@/lib/utils";
import { composeRefs } from "@/lib/compose-refs";
import { useSidebar } from "./sidebar-context";

export interface SidebarContentProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

export function SidebarContent({ ref, children, className, onKeyDown, ...props }: SidebarContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { open, contentId } = useSidebar();
  const collapsed = !open;
  const ariaHidden = collapsed ? true : props["aria-hidden"];

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
      ref={composeRefs(containerRef, ref)}
      id={props.id ?? contentId}
      aria-hidden={ariaHidden}
      inert={collapsed ? true : undefined}
      hidden={collapsed || props.hidden || undefined}
      data-collapsed={collapsed ? "" : undefined}
      className={cn("flex-1 overflow-y-auto p-4", className)}
      onKeyDown={handleKeyDown}
    >
      {children}
    </div>
  );
}
