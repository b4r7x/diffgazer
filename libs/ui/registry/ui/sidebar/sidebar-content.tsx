"use client";

import { useRef, type HTMLAttributes, type KeyboardEvent, type Ref } from "react";
import { useNavigation } from "@/hooks/use-navigation";
import { cn } from "@/lib/utils";
import { composeRefs } from "@/lib/compose-refs";

export interface SidebarContentProps extends HTMLAttributes<HTMLDivElement> {
  ref?: Ref<HTMLDivElement>;
}

export function SidebarContent({ ref, children, className, onKeyDown, ...props }: SidebarContentProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "menuitem",
    orientation: "vertical",
    wrap: true,
    moveFocus: true,
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    navKeyDown(e);
    onKeyDown?.(e);
  };

  return (
    <div
      ref={composeRefs(containerRef, ref)}
      role="menu"
      className={cn("flex-1 overflow-y-auto p-4", className)}
      onKeyDown={handleKeyDown}
      {...props}
    >
      {children}
    </div>
  );
}
