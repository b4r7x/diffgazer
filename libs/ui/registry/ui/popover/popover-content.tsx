"use client";

import {
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
} from "react";
import { composeRefs } from "@/lib/compose-refs";
import { FloatingPanel, useFloatingPanelContext } from "../floating-panel";
import { useEscapeKey, useOutsideClick } from "@/hooks/use-outside-click";
import {
  type FloatingSide,
  type FloatingAlign,
} from "@/hooks/use-floating-position";
import { usePopoverContext, type PopoverPopupRole } from "./popover-context";
import { useAutoFocus } from "./use-auto-focus";

const FALLBACK_POPOVER_DIALOG_LABEL = "Popover";

export interface PopoverContentProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children" | "id" | "role" | "style"> {
  children: ReactNode;
  role?: PopoverPopupRole;
  side?: FloatingSide;
  align?: FloatingAlign;
  sideOffset?: number;
  alignOffset?: number;
  avoidCollisions?: boolean;
  collisionPadding?: number;
  autoFocus?: boolean;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  ref?: Ref<HTMLDivElement>;
}

export function PopoverContent({
  children,
  side = "bottom",
  align = "center",
  sideOffset = 6,
  alignOffset = 0,
  avoidCollisions = true,
  collisionPadding = 8,
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
  } = usePopoverContext();
  const contentRef = useRef<HTMLDivElement>(null);

  const isHover = triggerMode === "hover";
  const isClick = triggerMode === "click";
  const contentRole = isHover ? "tooltip" : role;
  const isDialog = contentRole === "dialog";
  const isMenu = contentRole === "menu";
  const triggerExcludeRefs = useMemo(() => [triggerRef], [triggerRef]);
  const escapeKeyOptions = useMemo(
    () => ({ ref: contentRef, excludeRefs: triggerExcludeRefs }),
    [triggerExcludeRefs],
  );
  const resolvedAriaLabel = ariaLabel ?? (isDialog && !ariaLabelledBy ? FALLBACK_POPOVER_DIALOG_LABEL : undefined);

  useOutsideClick(
    contentRef,
    () => {
      onOpenChange(false);
      triggerRef.current?.focus();
    },
    open && isClick,
    triggerExcludeRefs,
  );

  useEscapeKey((e) => {
    e.stopPropagation();
    e.preventDefault();
    onOpenChange(false);
    triggerRef.current?.focus();
  }, open, escapeKeyOptions);

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
      side={side}
      align={align}
      sideOffset={sideOffset}
      alignOffset={alignOffset}
      avoidCollisions={avoidCollisions}
      collisionPadding={collisionPadding}
      ref={composeRefs(contentRef, ref)}
      id={popoverId}
      role={contentRole}
      aria-label={resolvedAriaLabel}
      aria-labelledby={ariaLabelledBy}
      tabIndex={tabIndex ?? (isDialog ? -1 : undefined)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      className={className}
    >
      <PopoverAutoFocus contentRef={contentRef} enabled={shouldAutoFocus} fallbackToContainer={isDialog} />
      {children}
    </FloatingPanel>
  );
}

interface PopoverAutoFocusProps {
  contentRef: RefObject<HTMLDivElement | null>;
  enabled: boolean;
  fallbackToContainer: boolean;
}

function PopoverAutoFocus({ contentRef, enabled, fallbackToContainer }: PopoverAutoFocusProps) {
  const { positioned } = useFloatingPanelContext();
  useAutoFocus(contentRef, enabled && positioned, fallbackToContainer);
  return null;
}
