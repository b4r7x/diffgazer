"use client";

import { type ComponentPropsWithRef, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export type ScrollOrientation = "vertical" | "horizontal" | "both";

const orientationClasses: Record<ScrollOrientation, string> = {
  vertical: "overflow-y-auto overflow-x-hidden",
  horizontal: "overflow-x-auto overflow-y-hidden",
  both: "overflow-auto",
};

export interface ScrollAreaProps extends ComponentPropsWithRef<"div"> {
  orientation?: ScrollOrientation;
  keyboardScrollable?: boolean;
}

export function ScrollArea({
  children,
  className,
  orientation = "vertical",
  keyboardScrollable = true,
  ref,
  onKeyDown,
  role: roleProp,
  tabIndex,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...props
}: ScrollAreaProps) {
  const canScrollV = orientation === "vertical" || orientation === "both";
  const canScrollH = orientation === "horizontal" || orientation === "both";
  const hasAccessibleName = Boolean(ariaLabel || ariaLabelledBy);
  const canKeyboardScroll = keyboardScrollable && hasAccessibleName;
  const role = roleProp ?? (hasAccessibleName ? "region" : undefined);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    const el = e.currentTarget;
    const pageStep = el.clientHeight * 0.8;

    switch (e.key) {
      case "ArrowUp":
        if (!canScrollV) break;
        el.scrollTop -= 40;
        e.preventDefault();
        break;
      case "ArrowDown":
        if (!canScrollV) break;
        el.scrollTop += 40;
        e.preventDefault();
        break;
      case "ArrowLeft":
        if (!canScrollH) break;
        el.scrollLeft -= 40;
        e.preventDefault();
        break;
      case "ArrowRight":
        if (!canScrollH) break;
        el.scrollLeft += 40;
        e.preventDefault();
        break;
      case "PageUp":
        el.scrollTop -= pageStep;
        e.preventDefault();
        break;
      case "PageDown":
        el.scrollTop += pageStep;
        e.preventDefault();
        break;
      case "Home":
        el.scrollTop = 0;
        if (canScrollH) el.scrollLeft = 0;
        e.preventDefault();
        break;
      case "End":
        el.scrollTop = el.scrollHeight;
        if (canScrollH) el.scrollLeft = el.scrollWidth;
        e.preventDefault();
        break;
    }
  };

  return (
    <div
      ref={ref}
      role={role}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      tabIndex={canKeyboardScroll ? (tabIndex ?? 0) : tabIndex}
      onKeyDown={canKeyboardScroll ? handleKeyDown : onKeyDown}
      className={cn(
        "scrollbar-thin rounded-[inherit] [scrollbar-gutter:stable]",
        canKeyboardScroll && "focus:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        orientationClasses[orientation],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
