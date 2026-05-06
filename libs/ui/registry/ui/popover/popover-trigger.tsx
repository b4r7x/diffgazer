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
import { usePopoverContext } from "./popover-context";

type PopoverTriggerHasPopup = "dialog" | "menu" | "listbox" | "tree" | "grid";

export interface PopoverTriggerRenderProps {
  ref: RefCallback<HTMLElement>;
  className?: string;
  role?: "button";
  "aria-expanded"?: boolean;
  "aria-haspopup"?: PopoverTriggerHasPopup;
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
  "aria-haspopup"?: PopoverTriggerHasPopup;
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

function getElementTextLabel(element: ReactElement<HoverTriggerElementProps>): string | undefined {
  const children = element.props.children;
  if (typeof children === "string" || typeof children === "number") return String(children);
  return undefined;
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

  const handleHoverKeyDown: KeyboardEventHandler<HTMLElement> = (event) => {
    if (!enabled) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onOpenChange(!open);
  };

  const triggerProps = isClick
    ? ({
        ref: composedRef,
        className,
        "aria-expanded": open,
        "aria-haspopup": "dialog",
        "aria-controls": open ? popoverId : undefined,
        onClick: onTriggerClick,
      } satisfies PopoverTriggerRenderProps)
    : ({
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
      } satisfies PopoverTriggerRenderProps);

  if (typeof children === "function") return <>{children(triggerProps)}</>;

  if (isValidElement<HoverTriggerElementProps>(children)) {
    const child = children as ReactElement<HoverTriggerElementProps>;
    const childRef = child.props.ref;
    const isNativeInteractive = isNativeInteractiveElement(child);
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

    const needsTabIndex = enabled && child.props.tabIndex === undefined && !isNativeInteractive;
    const isDisabledNative = triggerMode === "hover" && isNativeInteractive && child.props.disabled;

    if (isDisabledNative) {
      const spanProps = triggerProps satisfies ComponentPropsWithRef<"span">;
      const ariaLabel = child.props["aria-label"] ?? getElementTextLabel(child);
      return (
        <span {...spanProps} aria-label={ariaLabel}>
          {cloneElement(child, {
            className: cn(child.props.className, className),
            "aria-hidden": true,
            tabIndex: -1,
          })}
        </span>
      );
    }

    return cloneElement(child, {
      ref: composeRefs(composedRef, childRef),
      className: cn(child.props.className, className),
      role: child.props.role ?? (isNativeInteractive ? undefined : triggerProps.role),
      "aria-describedby": triggerProps["aria-describedby"],
      onClick: mergeHandlers(child.props.onClick, triggerProps.onClick, true),
      onMouseEnter: mergeHandlers(child.props.onMouseEnter, triggerProps.onMouseEnter),
      onMouseLeave: mergeHandlers(child.props.onMouseLeave, triggerProps.onMouseLeave),
      onFocus: mergeHandlers(child.props.onFocus, triggerProps.onFocus),
      onBlur: mergeHandlers(child.props.onBlur, triggerProps.onBlur),
      onKeyDown: mergeHandlers(child.props.onKeyDown, triggerProps.onKeyDown, true),
      tabIndex: needsTabIndex ? 0 : child.props.tabIndex,
    });
  }

  if (isClick) {
    const buttonProps = triggerProps satisfies ComponentPropsWithRef<"button">;
    return <button type="button" {...buttonProps}>{children}</button>;
  }

  const spanProps = triggerProps satisfies ComponentPropsWithRef<"span">;
  return <span {...spanProps}>{children}</span>;
}
