"use client";

import {
  type ComponentPropsWithoutRef,
  type FocusEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import type { FloatingAlign, FloatingSide } from "@/hooks/use-floating-position";
import { FloatingPanel, useFloatingPanelContext } from "../floating-panel";
import { useAriaLinkedPortalContainer } from "../shared/portal";
import { type PopoverPopupRole, usePopoverContext } from "./popover-context";
import { useAutoFocus } from "./use-auto-focus";
import { usePopoverContentDismissal } from "./use-content-dismissal";

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
  const composedRef = useComposedRefs(contentRef, ref);

  const isHover = triggerMode === "hover";
  const isClick = triggerMode === "click";
  const contentRole = isHover ? "tooltip" : role;
  const isDialog = contentRole === "dialog";
  const isMenu = contentRole === "menu";
  const resolvedAriaLabel =
    ariaLabel ?? (isDialog && !ariaLabelledBy ? FALLBACK_POPOVER_DIALOG_LABEL : undefined);
  const resolvedPortalContainer = useAriaLinkedPortalContainer(
    portalContainer,
    triggerRef,
    "Popover",
  );

  const {
    onExitComplete,
    onFocusCaptureDismissal,
    onBlurCaptureDismissal,
    onKeyDownDismissal,
  } = usePopoverContentDismissal({
    open,
    isClick,
    triggerRef,
    contentRef,
    markDismissed,
    onOpenChange,
  });

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
    onFocusCaptureDismissal();
  };

  const handleBlurCapture = (e: FocusEvent<HTMLDivElement>) => {
    onBlurCapture?.(e);
    onBlurCaptureDismissal(e);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;
    onKeyDownDismissal(e);
  };

  const shouldAutoFocus = open && (isDialog || isMenu) && autoFocus;

  return (
    <FloatingPanel
      {...rest}
      open={open}
      triggerRef={triggerRef}
      portalContainer={resolvedPortalContainer}
      side={side}
      align={align}
      sideOffset={sideOffset}
      alignOffset={alignOffset}
      avoidCollisions={avoidCollisions}
      collisionPadding={collisionPadding}
      onExitComplete={onExitComplete}
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
  /** Whether autofocus runs when the popover is positioned. */
  enabled: boolean;
  fallbackToContainer: boolean;
}

function PopoverAutoFocus({ contentRef, enabled, fallbackToContainer }: PopoverAutoFocusProps) {
  const { positioned } = useFloatingPanelContext();
  useAutoFocus(contentRef, enabled && positioned, fallbackToContainer);
  return null;
}
