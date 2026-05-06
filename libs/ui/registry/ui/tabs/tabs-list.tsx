"use client";

import { useRef, type HTMLAttributes, type KeyboardEvent, type Ref } from "react";
import { composeRefs } from "@/lib/compose-refs";
import { useNavigation } from "@/hooks/use-navigation";
import { cn } from "@/lib/utils";
import { useTabsContext } from "./tabs-context";

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  loop?: boolean;
  ref?: Ref<HTMLDivElement>;
}

export function TabsList({ children, className, loop = true, onKeyDown, ref, ...rest }: TabsListProps) {
  const { orientation, variant, value, onValueChange, activationMode } = useTabsContext();

  const containerRef = useRef<HTMLDivElement>(null);

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "tab",
    orientation,
    wrap: loop,
    moveFocus: true,
    ...(activationMode === "automatic" && {
      value: value || undefined,
      onValueChange,
    }),
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (!e.defaultPrevented) navKeyDown(e);
  };

  return (
    <div
      ref={composeRefs(containerRef, ref)}
      className={cn(
        "flex font-mono",
        variant === "underline" ? "border-b border-border gap-8" : "gap-1",
        orientation === "vertical" && "flex-col",
        className
      )}
      role="tablist"
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </div>
  );
}
