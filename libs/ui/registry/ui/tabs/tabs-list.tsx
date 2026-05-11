"use client";

import { useRef, type FocusEvent, type HTMLAttributes, type KeyboardEvent, type Ref } from "react";
import { composeRefs } from "@/lib/compose-refs";
import { useNavigation } from "@/hooks/use-navigation";
import { cn } from "@/lib/utils";
import { useTabsContext } from "./tabs-context";

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  loop?: boolean;
  ref?: Ref<HTMLDivElement>;
}

export function TabsList({ children, className, loop = true, onBlur, onKeyDown, ref, ...rest }: TabsListProps) {
  const { orientation, variant, value, tabbableValue, onChange, onFocusChange, activationMode } = useTabsContext();

  const containerRef = useRef<HTMLDivElement>(null);

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "tab",
    orientation,
    wrap: loop,
    moveFocus: true,
    scopeToContainer: true,
    ...(activationMode === "automatic"
      ? {
          highlighted: value || undefined,
          onHighlightChange: onChange,
        }
      : {
          highlighted: tabbableValue || undefined,
          onHighlightChange: onFocusChange,
          onEnter: onChange,
          onSelect: onChange,
        }),
  });

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (!e.defaultPrevented) navKeyDown(e);
  };

  const handleBlur = (event: FocusEvent<HTMLDivElement>) => {
    onBlur?.(event);

    const container = containerRef.current;
    const nextTarget = event.relatedTarget;
    const View = container?.ownerDocument.defaultView;
    const focusRemainsInside =
      Boolean(View && nextTarget instanceof View.Node && container?.contains(nextTarget));

    if (!focusRemainsInside) onFocusChange(null);
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
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      {...rest}
    >
      {children}
    </div>
  );
}
