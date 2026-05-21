"use client";

import { useRef, type HTMLAttributes, type KeyboardEvent, type Ref } from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { cn } from "@/lib/utils";
import { composeRefs } from "@/lib/compose-refs";
import { useSidebar } from "./sidebar-context";

export interface SidebarContentProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

/**
 * Scroll body for the sidebar. Hides itself when `state === "hidden"` so its
 * descendants drop out of the tab order; rail state keeps it mounted (icons
 * only) so collapsing does not lose focus or scroll position.
 */
export function SidebarContent({ ref, children, className, onKeyDown, ...props }: SidebarContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
      ref={composeRefs(containerRef, ref)}
      id={props.id ?? contentId}
      aria-hidden={ariaHidden}
      inert={hidden ? true : undefined}
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
