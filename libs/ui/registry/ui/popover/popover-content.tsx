"use client";

import {
  useMemo,
  useRef,
  type ComponentPropsWithoutRef,
  type AnimationEvent,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type Ref,
} from "react";
import { cn } from "@/lib/utils";
import { composeRefs } from "@/lib/compose-refs";
import { Portal } from "../shared/portal";
import { usePortalContainer } from "../shared/portal-context";
import { useEscapeKey, useOutsideClick } from "@/hooks/use-outside-click";
import { usePresence } from "@/hooks/use-presence";
import {
  useFloatingPosition,
  type FloatingSide,
  type FloatingAlign,
} from "@/hooks/use-floating-position";
import { usePopoverContext, type PopoverPopupRole } from "./popover-context";
import { useAutoFocus } from "./use-auto-focus";

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
  onAnimationEnd: externalOnAnimationEnd,
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
  } =
    usePopoverContext();
  const presenceRef = useRef<HTMLDivElement>(null);
  const { present, onAnimationEnd } = usePresence({ open, ref: presenceRef });
  const { position, contentRef } = useFloatingPosition({
    triggerRef,
    open: present,
    side,
    align,
    sideOffset,
    alignOffset,
    avoidCollisions,
    collisionPadding,
  });

  const portalContainer = usePortalContainer();
  const isHover = triggerMode === "hover";
  const isClick = triggerMode === "click";
  const contentRole = isHover ? "tooltip" : role;
  const hasAccessibleName = Boolean(ariaLabel || ariaLabelledBy);
  const isDialog = contentRole === "dialog";
  const triggerExcludeRefs = useMemo(() => [triggerRef], [triggerRef]);
  const escapeKeyOptions = useMemo(
    () => ({ ref: contentRef, excludeRefs: triggerExcludeRefs }),
    [contentRef, triggerExcludeRefs],
  );

  if (isDialog && !hasAccessibleName) {
    throw new Error("Popover.Content with role=\"dialog\" requires aria-label or aria-labelledby.");
  }

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

  useAutoFocus(contentRef, open && isDialog && autoFocus);

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

  const handleAnimationEnd = (e: AnimationEvent<HTMLDivElement>) => {
    externalOnAnimationEnd?.(e);
    onAnimationEnd(e);
  };

  if (!present) return null;

  return (
    <Portal container={portalContainer ?? undefined}>
      <div
        {...rest}
        ref={composeRefs(presenceRef, contentRef, ref)}
        id={popoverId}
        role={contentRole}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={tabIndex ?? (isDialog ? -1 : undefined)}
        data-state={open ? "open" : "closed"}
        data-side={position?.side}
        data-align={position?.align}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onKeyDown={handleKeyDown}
        onAnimationEnd={handleAnimationEnd}
        className={cn(
          "fixed z-9999",
          "data-[state=open]:animate-[slide-in_0.15s_ease-out]",
          "data-[state=closed]:animate-[slide-out_0.15s_ease-in_forwards]",
          className,
        )}
        style={
          position
            ? { top: position.y, left: position.x }
            : { visibility: "hidden", position: "fixed", top: 0, left: 0 }
        }
      >
        {children}
      </div>
    </Portal>
  );
}
