"use client";

import { useRef, type FocusEvent, type HTMLAttributes, type KeyboardEvent, type Ref } from "react";
import { composeRefs } from "@/lib/compose-refs";
import { useNavigation } from "@/hooks/use-navigation";
import { useFloatingIndicator } from "@/hooks/use-floating-indicator";
import {
  segmentedContainerVariants,
  segmentedPillIndicatorClass,
} from "@/lib/segmented-variants";
import { cn } from "@/lib/utils";
import { useTabsContext } from "./tabs-context";

export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {
  loop?: boolean;
  ref?: Ref<HTMLDivElement>;
}

export function TabsList({ children, className, loop = true, onBlur, onKeyDown, ref, ...rest }: TabsListProps) {
  const { orientation, variant, value, tabbableValue, onChange, onFocusChange, activationMode } = useTabsContext();

  const containerRef = useRef<HTMLDivElement>(null);

  const handleHighlightChange = (next: string | null) => {
    if (next === null) return;
    if (activationMode === "automatic") onChange(next);
    else onFocusChange(next);
  };

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef,
    role: "tab",
    orientation,
    wrap: loop,
    moveFocus: true,
    scopeToContainer: true,
    highlighted: (activationMode === "automatic" ? value : tabbableValue) || undefined,
    onHighlightChange: handleHighlightChange,
    ...(activationMode !== "automatic" && {
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

  // Pill variant: a single absolutely-positioned indicator tracks the active
  // tab's rect. The hook is null-fed when the variant doesn't use a pill, so
  // the observer is never created.
  const pillTargetValue = variant === "pill" ? value : null;
  const pillRect = useFloatingIndicator(containerRef, pillTargetValue);

  return (
    <div
      ref={composeRefs(containerRef, ref)}
      role="tablist"
      data-variant={variant}
      data-orientation={orientation}
      aria-orientation={orientation}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn(
        segmentedContainerVariants({ variant, orientation }),
        className,
      )}
      {...rest}
    >
      {variant === "pill" && pillRect && (
        <span
          aria-hidden="true"
          data-slot="tabs-pill"
          className={segmentedPillIndicatorClass}
          style={{ left: pillRect.left, width: pillRect.width }}
        />
      )}
      {children}
    </div>
  );
}
