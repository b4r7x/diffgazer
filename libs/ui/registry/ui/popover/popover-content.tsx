"use client";

import { useRef, type ComponentPropsWithoutRef, type KeyboardEvent, type ReactNode, type Ref } from "react";
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
import { usePopoverContext } from "./popover-context";
import { useAutoFocus } from "./use-auto-focus";
import { FOCUSABLE_SELECTOR } from "@/lib/focus";

export interface PopoverContentProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children" | "id" | "role" | "style"> {
  children: ReactNode;
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
  autoFocus = true,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  tabIndex,
  ref,
  ...rest
}: PopoverContentProps) {
  const { open, triggerRef, popoverId, triggerMode, onOpenChange, onContentEnter, onContentLeave } =
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

  useOutsideClick(
    contentRef,
    () => {
      onOpenChange(false);
      triggerRef.current?.focus();
    },
    open && isClick,
    [triggerRef],
  );

  useEscapeKey((e) => {
    e.stopPropagation();
    e.preventDefault();
    onOpenChange(false);
    triggerRef.current?.focus();
  }, open, { ref: contentRef, excludeRefs: [triggerRef] });

  useAutoFocus(contentRef, open && !isHover && autoFocus);

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      onOpenChange(false);
      triggerRef.current?.focus();
      return;
    }

    if (!isClick) return;
    if (e.key !== "Tab") return;

    const el = contentRef.current;
    if (!el) return;

    const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  if (!present) return null;

  return (
    <Portal container={portalContainer ?? undefined}>
      <div
        {...rest}
        ref={composeRefs(presenceRef, contentRef, ref)}
        id={popoverId}
        role={isHover ? "tooltip" : "dialog"}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        tabIndex={tabIndex ?? (isHover ? undefined : -1)}
        data-state={open ? "open" : "closed"}
        data-side={position?.side}
        data-align={position?.align}
        onMouseEnter={isHover ? onContentEnter : undefined}
        onMouseLeave={isHover ? onContentLeave : undefined}
        onKeyDown={handleKeyDown}
        onAnimationEnd={onAnimationEnd}
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
