"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentPropsWithRef, KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

/** Class variants for scroll area. */
export const scrollAreaVariants = cva(
  "scrollbar-thin rounded-[inherit] [scrollbar-gutter:stable]",
  {
    variants: {
      orientation: {
        vertical: "overflow-y-auto overflow-x-hidden",
        horizontal: "overflow-x-auto overflow-y-hidden",
        both: "overflow-auto",
      },
    },
    defaultVariants: { orientation: "vertical" },
  },
);

/** Thin-scrollbar wrapper with vertical, horizontal, or both overflow directions. */
export type ScrollOrientation = NonNullable<VariantProps<typeof scrollAreaVariants>["orientation"]>;

/** Props for scroll area. */
export interface ScrollAreaProps extends ComponentPropsWithRef<"div"> {
  /** Axes that overflow. Other axes are clipped. */
  orientation?: ScrollOrientation;
  /**
   * When true and the region has an accessible name (aria-label or aria-labelledby), wires
   * Arrow/PageUp/PageDown/Home/End to scroll the container and applies role="region" with
   * tabIndex={0}.
   */
  keyboardScrollable?: boolean;
}

/** Thin-scrollbar wrapper with vertical, horizontal, or both overflow directions. */
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
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.target !== e.currentTarget) return;

    const el = e.currentTarget;
    const hasVerticalOverflow = canScrollV && el.scrollHeight > el.clientHeight;
    const hasHorizontalOverflow = canScrollH && el.scrollWidth > el.clientWidth;
    const pageStepV = el.clientHeight * 0.8;
    const pageStepH = el.clientWidth * 0.8;
    const pageScrollsHorizontal = orientation === "horizontal";

    switch (e.key) {
      case "ArrowUp":
        if (!hasVerticalOverflow) break;
        el.scrollTop -= 40;
        e.preventDefault();
        break;
      case "ArrowDown":
        if (!hasVerticalOverflow) break;
        el.scrollTop += 40;
        e.preventDefault();
        break;
      case "ArrowLeft":
        if (!hasHorizontalOverflow) break;
        el.scrollLeft -= 40;
        e.preventDefault();
        break;
      case "ArrowRight":
        if (!hasHorizontalOverflow) break;
        el.scrollLeft += 40;
        e.preventDefault();
        break;
      case "PageUp":
        if (pageScrollsHorizontal) {
          if (!hasHorizontalOverflow) break;
          el.scrollLeft -= pageStepH;
        } else if (hasVerticalOverflow) {
          el.scrollTop -= pageStepV;
        } else {
          break;
        }
        e.preventDefault();
        break;
      case "PageDown":
        if (pageScrollsHorizontal) {
          if (!hasHorizontalOverflow) break;
          el.scrollLeft += pageStepH;
        } else if (hasVerticalOverflow) {
          el.scrollTop += pageStepV;
        } else {
          break;
        }
        e.preventDefault();
        break;
      case "Home":
        if (!hasVerticalOverflow && !hasHorizontalOverflow) break;
        if (hasVerticalOverflow) el.scrollTop = 0;
        if (hasHorizontalOverflow) el.scrollLeft = 0;
        e.preventDefault();
        break;
      case "End":
        if (!hasVerticalOverflow && !hasHorizontalOverflow) break;
        if (hasVerticalOverflow) el.scrollTop = el.scrollHeight;
        if (hasHorizontalOverflow) el.scrollLeft = el.scrollWidth;
        e.preventDefault();
        break;
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the scroll container conditionally takes a scrollbar/region role and owns keyboard scrolling; Biome cannot resolve the dynamic role.
    // biome-ignore lint/a11y/useAriaPropsSupportedByRole: aria-label/aria-labelledby apply to the dynamic role assigned to this scroll region, which Biome cannot statically resolve.
    <div
      ref={ref}
      role={role}
      data-slot="scroll-area"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      tabIndex={canKeyboardScroll ? (tabIndex ?? 0) : tabIndex}
      onKeyDown={canKeyboardScroll ? handleKeyDown : onKeyDown}
      className={cn(
        scrollAreaVariants({ orientation }),
        canKeyboardScroll &&
          "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-[-2px]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
