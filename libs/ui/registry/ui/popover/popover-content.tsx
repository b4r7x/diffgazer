"use client";

import {
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useEffect,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import type { FloatingAlign, FloatingSide } from "@/hooks/use-floating-position";
import { useEscapeKey, useOutsideClick } from "@/hooks/use-outside-click";
import { FloatingPanel, useFloatingPanelContext } from "../floating-panel";
import { type PopoverPopupRole, usePopoverContext } from "./popover-context";
import { useAutoFocus } from "./use-auto-focus";

const FALLBACK_POPOVER_DIALOG_LABEL = "Popover";

/** Props for popover content. */
export interface PopoverContentProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children" | "id" | "role" | "style"> {
  /** Popover body content. */
  children: ReactNode;
  /**
   * Popup role. Ignored when the popover opens on hover: hover popovers are always
   * `role="tooltip"`. For click/focus popovers this role is used as-is (e.g. `"dialog"` or
   * `"menu"`); a `"dialog"` popup also gains a fallback accessible name and is focusable.
   * Switch `triggerMode` off hover to take control of the role.
   */
  role?: PopoverPopupRole;
  /** Preferred side relative to the trigger. */
  side?: FloatingSide;
  /** Alignment along the chosen side. */
  align?: FloatingAlign;
  /** Pixel gap from the trigger along the side axis. */
  sideOffset?: number;
  /** Pixel offset along the alignment axis. */
  alignOffset?: number;
  /** Flips to the opposite side, then cross-axis sides, then shifts within the viewport. */
  avoidCollisions?: boolean;
  /** Minimum gap between the content and the viewport edge during collision avoidance. */
  collisionPadding?: number;
  /**
   * Dialog and menu roles only. When true, focuses the first focusable child on open (or the
   * content itself for role="dialog" without a focusable child).
   */
  autoFocus?: boolean;
  /** portal container used by popover content. */
  portalContainer?: Element | null;
  /** Accessible name when no visible label is supplied. */
  "aria-label"?: string;
  /** ID of the element that labels this component. */
  "aria-labelledby"?: string;
  /** Stable slot marker for styling and tests. */
  "data-slot"?: string;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLDivElement>;
}

/** Portal-rendered positioned content with collision avoidance. */
export function PopoverContent({
  children,
  side = "bottom",
  align = "center",
  sideOffset = 6,
  alignOffset = 0,
  avoidCollisions = true,
  collisionPadding = 8,
  portalContainer,
  className,
  role,
  autoFocus = true,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  tabIndex,
  ref,
  onMouseEnter,
  onMouseLeave,
  onKeyDown,
  "data-slot": dataSlot = "popover-content",
  ...rest
}: PopoverContentProps) {
  const {
    open,
    triggerRef,
    popoverId,
    triggerMode,
    onOpenChange,
    onContentEnter,
    onContentLeave,
    markDismissed,
  } = usePopoverContext();
  const contentRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(contentRef, ref);

  const isHover = triggerMode === "hover";
  const isClick = triggerMode === "click";
  const contentRole = isHover ? "tooltip" : role;
  const isDialog = contentRole === "dialog";
  const isMenu = contentRole === "menu";
  const resolvedAriaLabel =
    ariaLabel ?? (isDialog && !ariaLabelledBy ? FALLBACK_POPOVER_DIALOG_LABEL : undefined);

  // useOutsideClick/useEscapeKey read excludeRefs/options through internal refs,
  // so inline arrays/objects here no longer re-register the overlay-stack entry.
  useOutsideClick(
    contentRef,
    () => {
      markDismissed();
      onOpenChange(false);
      triggerRef.current?.focus();
    },
    open && isClick,
    [triggerRef],
  );

  useEscapeKey(
    (e) => {
      e.stopPropagation();
      e.preventDefault();
      markDismissed();
      onOpenChange(false);
      triggerRef.current?.focus();
    },
    open,
    { ref: contentRef, excludeRefs: [triggerRef] },
  );

  // Focus-out dismissal for click-mode popovers: Tabbing past the last focusable
  // element (or otherwise moving focus outside both content and trigger) closes
  // the portaled popover instead of leaving it open with focus at the end of the
  // document. Moving focus between the trigger and content does NOT close it.
  useEffect(() => {
    if (!open || !isClick) return;
    const content = contentRef.current;
    if (!content) return;

    const handleFocusOut = (event: FocusEvent) => {
      const next = event.relatedTarget;
      const View = content.ownerDocument.defaultView;
      if (View && next instanceof View.Node) {
        const path = typeof event.composedPath === "function" ? event.composedPath() : [];
        const inContent = content.contains(next) || path.includes(content);
        const trigger = triggerRef.current;
        const inTrigger = !!trigger && (trigger.contains(next) || path.includes(trigger));
        if (inContent || inTrigger) return;
      }
      onOpenChange(false);
    };

    content.addEventListener("focusout", handleFocusOut);
    return () => content.removeEventListener("focusout", handleFocusOut);
  }, [open, isClick, onOpenChange, triggerRef]);

  const handleMouseEnter = (e: MouseEvent<HTMLDivElement>) => {
    onMouseEnter?.(e);
    if (isHover) onContentEnter();
  };

  const handleMouseLeave = (e: MouseEvent<HTMLDivElement>) => {
    onMouseLeave?.(e);
    if (isHover) onContentLeave();
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      markDismissed();
      onOpenChange(false);
      triggerRef.current?.focus();
    }
  };

  const shouldAutoFocus = open && (isDialog || isMenu) && autoFocus;

  return (
    <FloatingPanel
      {...rest}
      open={open}
      triggerRef={triggerRef}
      portalContainer={portalContainer}
      side={side}
      align={align}
      sideOffset={sideOffset}
      alignOffset={alignOffset}
      avoidCollisions={avoidCollisions}
      collisionPadding={collisionPadding}
      ref={composedRef}
      id={popoverId}
      role={contentRole}
      data-slot={dataSlot}
      aria-label={resolvedAriaLabel}
      aria-labelledby={ariaLabelledBy}
      tabIndex={tabIndex ?? (isDialog ? -1 : undefined)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      className={className}
    >
      <PopoverAutoFocus
        contentRef={contentRef}
        enabled={shouldAutoFocus}
        fallbackToContainer={isDialog}
      />
      {children}
    </FloatingPanel>
  );
}

/** Props for popover auto focus. */
interface PopoverAutoFocusProps {
  /** Ref for the content element. */
  contentRef: RefObject<HTMLDivElement | null>;
  /** When false, the popover never opens and trigger handlers are no-ops. */
  enabled: boolean;
  /** fallback to container used by popover auto focus. */
  fallbackToContainer: boolean;
}

function PopoverAutoFocus({ contentRef, enabled, fallbackToContainer }: PopoverAutoFocusProps) {
  const { positioned } = useFloatingPanelContext();
  useAutoFocus(contentRef, enabled && positioned, fallbackToContainer);
  return null;
}
