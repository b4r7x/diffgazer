"use client";

import {
  type ComponentProps,
  createContext,
  type FocusEvent,
  type KeyboardEvent,
  useContext,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useFloatingIndicator } from "@/hooks/use-floating-indicator";
import { useNavigation } from "@/hooks/use-navigation";
import {
  segmentedContainerVariants,
  segmentedPillIndicatorClass,
  segmentedUnderlineIndicatorClass,
} from "@/lib/segmented-variants";
import { cn } from "@/lib/utils";
import { useTabsContext } from "./tabs-context";

type TabsListNativeProps = Omit<ComponentProps<"div">, "aria-orientation" | "role">;

/** Props for tabs list. */
export interface TabsListProps extends TabsListNativeProps {
  /** Allows horizontal triggers and their labels to wrap within the available width. */
  wrap?: boolean;
  /** When true, arrow navigation wraps from last to first trigger and vice versa. */
  loop?: boolean;
  /** Fired when arrow navigation reaches the first/last trigger with loop disabled. */
  onNavigationBoundaryReached?: (
    direction: "previous" | "next",
    event: globalThis.KeyboardEvent,
    key: string,
  ) => void;
}

const TabsListWrappedContext = createContext(false);

export function useTabsListWrapped(): boolean {
  return useContext(TabsListWrappedContext);
}

/** Container for tab triggers. */
export function TabsList({
  children,
  className,
  wrap = true,
  loop = true,
  onBlur,
  onKeyDown,
  onNavigationBoundaryReached,
  ref,
  ...rest
}: TabsListProps) {
  const { orientation, variant, value, tabbableValue, onChange, onFocusChange, activationMode } =
    useTabsContext();

  const containerRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(containerRef, ref);
  const wrapped = orientation === "horizontal" && wrap;

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
    onNavigationBoundaryReached,
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
    const focusRemainsInside = Boolean(
      View && nextTarget instanceof View.Node && container?.contains(nextTarget),
    );

    if (!focusRemainsInside) onFocusChange(null);
  };

  // Single-row variants use a floating indicator. Wrapped rows style each
  // active trigger locally because one absolute indicator cannot span rows.
  const pillTargetValue = variant === "pill" && !wrapped ? value : null;
  const pillRect = useFloatingIndicator(containerRef, pillTargetValue);

  const underlineTargetValue = variant === "underline" && !wrapped ? value : null;
  const underlineRect = useFloatingIndicator(containerRef, underlineTargetValue);

  return (
    <div
      {...rest}
      ref={composedRef}
      role="tablist"
      data-variant={variant}
      data-orientation={orientation}
      data-wrap={wrapped}
      aria-orientation={orientation}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn(segmentedContainerVariants({ variant, orientation, wrapped }), className)}
    >
      {variant === "pill" && pillRect && (
        <span
          aria-hidden="true"
          data-slot="tabs-pill"
          className={segmentedPillIndicatorClass}
          style={{ left: pillRect.left, width: pillRect.width }}
        />
      )}
      {variant === "underline" && underlineRect && (
        <span
          aria-hidden="true"
          data-slot="tabs-underline"
          className={segmentedUnderlineIndicatorClass}
          style={
            orientation === "vertical"
              ? { top: underlineRect.top, height: underlineRect.height, right: 0, width: 1 }
              : { left: underlineRect.left, width: underlineRect.width, bottom: 0, height: 1 }
          }
        />
      )}
      <TabsListWrappedContext value={wrapped}>{children}</TabsListWrappedContext>
    </div>
  );
}
