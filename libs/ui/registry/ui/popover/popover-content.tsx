"use client";

import {
  type ComponentPropsWithoutRef,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useEffect,
  useLayoutEffect,
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
  onFocusCapture,
  onBlurCapture,
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
  const wasOpenRef = useRef(open);
  const restoreFocusAfterCloseRef = useRef(false);
  const composedRef = useComposedRefs(contentRef, ref);

  const isHover = triggerMode === "hover";
  const isClick = triggerMode === "click";
  const contentRole = isHover ? "tooltip" : role;
  const isDialog = contentRole === "dialog";
  const isMenu = contentRole === "menu";
  const resolvedAriaLabel =
    ariaLabel ?? (isDialog && !ariaLabelledBy ? FALLBACK_POPOVER_DIALOG_LABEL : undefined);

  const isFocusWithinPopover = () => {
    const content = contentRef.current;
    const trigger = triggerRef.current;
    const ownerDocument = content?.ownerDocument ?? trigger?.ownerDocument;
    const activeElement = ownerDocument?.activeElement;
    if (!activeElement) return false;
    return !!content?.contains(activeElement) || !!trigger?.contains(activeElement);
  };

  const handleExitComplete = () => {
    if (!restoreFocusAfterCloseRef.current) return;
    const trigger = triggerRef.current;
    const ownerDocument = trigger?.ownerDocument ?? contentRef.current?.ownerDocument;
    const activeElement = ownerDocument?.activeElement;
    if (activeElement && activeElement !== ownerDocument?.body) {
      if (trigger?.contains(activeElement)) restoreFocusAfterCloseRef.current = false;
      return;
    }
    trigger?.focus();
    restoreFocusAfterCloseRef.current = false;
  };

  useLayoutEffect(() => {
    const wasOpen = wasOpenRef.current;
    wasOpenRef.current = open;
    if (!wasOpen || open) return;
    const content = contentRef.current;
    const trigger = triggerRef.current;
    const ownerDocument = content?.ownerDocument ?? trigger?.ownerDocument;
    const activeElement = ownerDocument?.activeElement;
    const focusWithinPopover =
      !!activeElement && (!!content?.contains(activeElement) || !!trigger?.contains(activeElement));
    restoreFocusAfterCloseRef.current = focusWithinPopover;
    if (focusWithinPopover) {
      trigger?.focus();
      restoreFocusAfterCloseRef.current = false;
    }
  }, [open, triggerRef]);

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
      const shouldRestoreFocus = isFocusWithinPopover();
      if (shouldRestoreFocus) {
        e.stopPropagation();
        e.preventDefault();
      }
      markDismissed();
      onOpenChange(false);
      if (shouldRestoreFocus) triggerRef.current?.focus();
    },
    open,
    { ref: contentRef, excludeRefs: [triggerRef] },
  );

  // Focus-out dismissal for click-mode popovers covers focus moves that do not
  // start with a Tab keydown inside the content.
  useEffect(() => {
    if (!open || !isClick) return;
    const content = contentRef.current;
    if (!content) return;

    const handleFocusOut = (event: globalThis.FocusEvent) => {
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

  const handleFocusCapture = (e: FocusEvent<HTMLDivElement>) => {
    onFocusCapture?.(e);
    restoreFocusAfterCloseRef.current = true;
  };

  const handleBlurCapture = (e: FocusEvent<HTMLDivElement>) => {
    onBlurCapture?.(e);
    const next = e.relatedTarget;
    const content = contentRef.current;
    const trigger = triggerRef.current;
    const View = content?.ownerDocument.defaultView ?? trigger?.ownerDocument.defaultView;
    if (View && next instanceof View.Node && (content?.contains(next) || trigger?.contains(next))) {
      return;
    }
    restoreFocusAfterCloseRef.current = false;
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    if (e.key === "Escape") {
      const shouldRestoreFocus = isFocusWithinPopover();
      if (shouldRestoreFocus) {
        e.stopPropagation();
        e.preventDefault();
      }
      markDismissed();
      onOpenChange(false);
      if (shouldRestoreFocus) triggerRef.current?.focus();
      return;
    }

    if (e.key === "Tab") {
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
      onExitComplete={handleExitComplete}
      ref={composedRef}
      id={popoverId}
      role={contentRole}
      data-slot={dataSlot}
      aria-label={resolvedAriaLabel}
      aria-labelledby={ariaLabelledBy}
      tabIndex={tabIndex ?? (isDialog ? -1 : undefined)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocusCapture={handleFocusCapture}
      onBlurCapture={handleBlurCapture}
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
  fallbackToContainer: boolean;
}

function PopoverAutoFocus({ contentRef, enabled, fallbackToContainer }: PopoverAutoFocusProps) {
  const { positioned } = useFloatingPanelContext();
  useAutoFocus(contentRef, enabled && positioned, fallbackToContainer);
  return null;
}
