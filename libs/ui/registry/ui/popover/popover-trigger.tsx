"use client";

import { type ReactNode, type RefCallback, type Ref } from "react";
import { cn } from "@/lib/utils";
import { composeRefs } from "@/lib/compose-refs";
import { usePopoverContext } from "./popover-context";

export interface PopoverTriggerRenderProps {
  ref: RefCallback<HTMLElement>;
  className?: string;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: "dialog";
  "aria-controls"?: string;
  "aria-describedby"?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  tabIndex?: number;
}

export interface PopoverTriggerProps {
  children: ReactNode | ((props: PopoverTriggerRenderProps) => ReactNode);
  className?: string;
  ref?: Ref<HTMLElement>;
}

export function PopoverTrigger({
  children,
  className,
  ref,
}: PopoverTriggerProps) {
  const {
    triggerRef,
    popoverId,
    open,
    triggerMode,
    onOpenChange,
    onTriggerEnter,
    onTriggerLeave,
    onTriggerClick,
    enabled,
  } = usePopoverContext();

  const composedRef = composeRefs(triggerRef, ref);
  const isClick = triggerMode === "click";
  const isRenderProp = typeof children === "function";
  const hoverClassName = isRenderProp ? className : cn("inline-flex", className);

  const handleHoverClick = () => {
    if (!enabled) return;
    onOpenChange(!open);
  };

  const triggerProps: PopoverTriggerRenderProps = {
    ref: composedRef,
    ...(isClick
      ? {
          className,
          "aria-expanded": open,
          "aria-haspopup": "dialog" as const,
          "aria-controls": open ? popoverId : undefined,
          onClick: onTriggerClick,
        }
      : {
          className: hoverClassName,
          "aria-describedby": open ? popoverId : undefined,
          onMouseEnter: onTriggerEnter,
          onMouseLeave: onTriggerLeave,
          onFocus: onTriggerEnter,
          onBlur: onTriggerLeave,
          onClick: handleHoverClick,
          tabIndex: enabled ? 0 : undefined,
        }),
  };

  if (typeof children === "function") return <>{children(triggerProps)}</>;

  if (isClick) {
    return <button type="button" {...triggerProps}>{children}</button>;
  }

  return <span {...triggerProps}>{children}</span>;
}
