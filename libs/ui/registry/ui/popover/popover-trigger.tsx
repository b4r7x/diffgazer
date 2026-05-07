"use client";

import {
  cloneElement,
  type ComponentPropsWithRef,
  type FocusEventHandler,
  type KeyboardEventHandler,
  isValidElement,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefCallback,
} from "react";
import { cn } from "@/lib/utils";
import { composeRefs } from "@/lib/compose-refs";
import { usePopoverContext, type PopoverPopupRole } from "./popover-context";

export interface PopoverTriggerRenderProps {
  ref: RefCallback<HTMLElement>;
  className?: string;
  role?: "button";
  "aria-expanded"?: boolean;
  "aria-haspopup"?: PopoverPopupRole;
  "aria-controls"?: string;
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  onFocus?: FocusEventHandler<HTMLElement>;
  onBlur?: FocusEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  tabIndex?: number;
}

export interface PopoverTriggerProps {
  children: ReactNode | ((props: PopoverTriggerRenderProps) => ReactNode);
  className?: string;
  ref?: Ref<HTMLElement>;
}

interface HoverTriggerElementProps {
  ref?: Ref<HTMLElement>;
  className?: string;
  type?: string;
  role?: string;
  tabIndex?: number;
  children?: ReactNode;
  "aria-expanded"?: boolean;
  "aria-haspopup"?: PopoverPopupRole;
  "aria-controls"?: string;
  "aria-describedby"?: string;
  "aria-label"?: string;
  "aria-hidden"?: boolean;
  onClick?: MouseEventHandler<HTMLElement>;
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  onFocus?: FocusEventHandler<HTMLElement>;
  onBlur?: FocusEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  disabled?: boolean;
}

const nativeInteractiveElements = new Set(["button", "a", "input", "select", "textarea", "summary"]);

function mergeHandlers<Event extends { defaultPrevented?: boolean }>(
  existing: ((event: Event) => void) | undefined,
  added: ((event: Event) => void) | undefined,
  skipWhenDefaultPrevented = false,
): (event: Event) => void {
  return (event) => {
    existing?.(event);
    if (skipWhenDefaultPrevented && event.defaultPrevented) return;
    added?.(event);
  };
}

function isNativeInteractiveElement(element: ReactElement<HoverTriggerElementProps>): boolean {
  return typeof element.type === "string" && nativeInteractiveElements.has(element.type);
}

function usesButtonLikeHoverSemantics(element: ReactElement<HoverTriggerElementProps>): boolean {
  return isNativeInteractiveElement(element) || element.props.role === "button";
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
    popupRole,
  } = usePopoverContext();

  const composedRef = composeRefs(triggerRef, ref);
  const isClick = triggerMode === "click";
  const isRenderProp = typeof children === "function";
  const hoverClassName = isRenderProp ? className : cn("inline-flex", className);

  const handleHoverClick = () => {
    if (!enabled) return;
    onOpenChange(!open);
  };

  const handleHoverKeyDown: KeyboardEventHandler<HTMLElement> = (event) => {
    if (!enabled) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onOpenChange(!open);
  };

  const clickTriggerProps: PopoverTriggerRenderProps = {
    ref: composedRef,
    className,
    "aria-expanded": open,
    "aria-haspopup": popupRole,
    "aria-controls": open ? popoverId : undefined,
    onClick: onTriggerClick,
  };
  const interactiveHoverTriggerProps: PopoverTriggerRenderProps = {
    ref: composedRef,
    role: "button",
    className: hoverClassName,
    "aria-describedby": open ? popoverId : undefined,
    onMouseEnter: onTriggerEnter,
    onMouseLeave: onTriggerLeave,
    onFocus: onTriggerEnter,
    onBlur: onTriggerLeave,
    onClick: handleHoverClick,
    onKeyDown: handleHoverKeyDown,
    tabIndex: enabled ? 0 : undefined,
  };
  const passiveHoverTriggerProps: PopoverTriggerRenderProps = {
    ref: composedRef,
    className: hoverClassName,
    "aria-describedby": open ? popoverId : undefined,
    onMouseEnter: onTriggerEnter,
    onMouseLeave: onTriggerLeave,
    onFocus: onTriggerEnter,
    onBlur: onTriggerLeave,
  };

  const triggerProps = isClick
    ? clickTriggerProps
    : interactiveHoverTriggerProps;

  const passiveTriggerProps = isClick ? clickTriggerProps : passiveHoverTriggerProps;

  if (typeof children === "function") return <>{children(triggerProps)}</>;

  if (isValidElement<HoverTriggerElementProps>(children)) {
    const child = children as ReactElement<HoverTriggerElementProps>;
    const childRef = child.props.ref;
    const isNativeInteractive = isNativeInteractiveElement(child);
    const isButtonLikeHover = usesButtonLikeHoverSemantics(child);
    const buttonType = child.type === "button" ? { type: child.props.type ?? "button" } : {};

    if (isClick && isNativeInteractive) {
      return cloneElement(child, {
        ...buttonType,
        ref: composeRefs(composedRef, childRef),
        className: cn(child.props.className, className),
        "aria-expanded": triggerProps["aria-expanded"],
        "aria-haspopup": triggerProps["aria-haspopup"],
        "aria-controls": triggerProps["aria-controls"],
        onClick: mergeHandlers(child.props.onClick, triggerProps.onClick, true),
      });
    }

    if (isClick) {
      const buttonProps = triggerProps satisfies ComponentPropsWithRef<"button">;
      return <button type="button" {...buttonProps}>{children}</button>;
    }

    const needsTabIndex = enabled && child.props.tabIndex === undefined && child.props.role === "button";
    const isDisabledNative = triggerMode === "hover" && isNativeInteractive && child.props.disabled;

    if (isDisabledNative) {
      const spanProps = passiveTriggerProps satisfies ComponentPropsWithRef<"span">;
      return (
        <span {...spanProps}>
          {cloneElement(child, {
            className: cn(child.props.className, className),
          })}
        </span>
      );
    }

    const hoverProps = isButtonLikeHover ? triggerProps : passiveTriggerProps;

    return cloneElement(child, {
      ref: composeRefs(composedRef, childRef),
      className: cn(child.props.className, className),
      role: child.props.role ?? (isClick || isNativeInteractive ? undefined : hoverProps.role),
      "aria-describedby": hoverProps["aria-describedby"],
      onClick: mergeHandlers(child.props.onClick, hoverProps.onClick, true),
      onMouseEnter: mergeHandlers(child.props.onMouseEnter, hoverProps.onMouseEnter),
      onMouseLeave: mergeHandlers(child.props.onMouseLeave, hoverProps.onMouseLeave),
      onFocus: mergeHandlers(child.props.onFocus, hoverProps.onFocus),
      onBlur: mergeHandlers(child.props.onBlur, hoverProps.onBlur),
      onKeyDown: mergeHandlers(child.props.onKeyDown, hoverProps.onKeyDown, true),
      tabIndex: needsTabIndex ? 0 : child.props.tabIndex,
    });
  }

  if (isClick) {
    const buttonProps = triggerProps satisfies ComponentPropsWithRef<"button">;
    return <button type="button" {...buttonProps}>{children}</button>;
  }

  const spanProps = passiveTriggerProps satisfies ComponentPropsWithRef<"span">;
  return <span {...spanProps}>{children}</span>;
}
