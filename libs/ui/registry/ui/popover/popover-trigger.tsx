"use client";

import {
  type ComponentPropsWithRef,
  cloneElement,
  type FocusEventHandler,
  isValidElement,
  type KeyboardEventHandler,
  type MouseEventHandler,
  type PointerEventHandler,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefCallback,
  useEffect,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { cn } from "@/lib/utils";
import { type PopoverPopupRole, usePopoverContext } from "./popover-context";

/** Props for popover trigger render. */
export interface PopoverTriggerRenderProps {
  /** Ref forwarded to the underlying element. */
  ref: RefCallback<HTMLElement>;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** ARIA role applied to the rendered element. */
  role?: "button";
  /** ARIA expanded state forwarded to the rendered element. */
  "aria-expanded"?: boolean;
  /** ARIA popup type forwarded to the rendered element. */
  "aria-haspopup"?: PopoverPopupRole;
  /** ID of the element controlled by the rendered element. */
  "aria-controls"?: string;
  /** ID of the element that describes this component. */
  "aria-describedby"?: string;
  /** Accessible name when no visible label is supplied. */
  "aria-label"?: string;
  /** ARIA hidden state forwarded to the rendered element. */
  "aria-hidden"?: boolean;
  /** Called when click occurs. */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Called when pointer down occurs. */
  onPointerDown?: PointerEventHandler<HTMLElement>;
  /** Called when mouse enter occurs. */
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  /** Called when mouse leave occurs. */
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  /** Called when focus occurs. */
  onFocus?: FocusEventHandler<HTMLElement>;
  /** Called when blur occurs. */
  onBlur?: FocusEventHandler<HTMLElement>;
  /** Called when key down occurs. */
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  /** Tab index applied to the rendered element. */
  tabIndex?: number;
}

/** Props for popover trigger. */
export interface PopoverTriggerProps {
  /**
   * Trigger element. Pass a single element (cloned with merged ARIA/handlers), text (wrapped in
   * <button>), or a render function for full control.
   */
  children: ReactNode | ((props: PopoverTriggerRenderProps) => ReactNode);
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLElement>;
}

/** Props for hover trigger element. */
interface HoverTriggerElementProps {
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLElement>;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Selection mode. */
  type?: string;
  /** ARIA role applied to the rendered element. */
  role?: string;
  /** Tab index applied to the rendered element. */
  tabIndex?: number;
  /** Popover.Trigger and Popover.Content subparts. */
  children?: ReactNode;
  /** ARIA expanded state forwarded to the rendered element. */
  "aria-expanded"?: boolean;
  /** ARIA popup type forwarded to the rendered element. */
  "aria-haspopup"?: PopoverPopupRole;
  /** ID of the element controlled by the rendered element. */
  "aria-controls"?: string;
  /** ID of the element that describes this component. */
  "aria-describedby"?: string;
  /** Accessible name when no visible label is supplied. */
  "aria-label"?: string;
  /** ARIA hidden state forwarded to the rendered element. */
  "aria-hidden"?: boolean;
  /** Called when click occurs. */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Called when pointer down occurs. */
  onPointerDown?: PointerEventHandler<HTMLElement>;
  /** Called when mouse enter occurs. */
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  /** Called when mouse leave occurs. */
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  /** Called when focus occurs. */
  onFocus?: FocusEventHandler<HTMLElement>;
  /** Called when blur occurs. */
  onBlur?: FocusEventHandler<HTMLElement>;
  /** Called when key down occurs. */
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  /** Disables interaction. */
  disabled?: boolean;
}

const nativeInteractiveElements = new Set([
  "button",
  "a",
  "input",
  "select",
  "textarea",
  "summary",
]);

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

/** Element that activates the popover (click or hover) */
export function PopoverTrigger({ children, className, ref }: PopoverTriggerProps) {
  const {
    triggerRef,
    popoverId,
    open,
    triggerMode,
    onOpenChange,
    onTriggerEnter,
    onTriggerFocus,
    onTriggerLeave,
    onTriggerClick,
    onTriggerPointerDown,
    enabled,
    popupRole,
  } = usePopoverContext();

  const childRef = isValidElement<HoverTriggerElementProps>(children)
    ? children.props.ref
    : undefined;
  const composedRef = useComposedRefs(triggerRef, ref, childRef);
  const isClick = triggerMode === "click";
  const isRenderProp = typeof children === "function";
  const hoverClassName = isRenderProp ? className : cn("inline-flex", className);

  // Hover-mode popover opened via tap (touch) or focus has no hover-leave to
  // dismiss it. Mirror click-mode useOutsideClick semantics so any pointerdown
  // outside the trigger and portaled content closes the popover.
  useEffect(() => {
    if (isClick || !open || !enabled) return;
    const trigger = triggerRef.current;
    if (!trigger) return;
    const handlePointerDown = (event: PointerEvent) => {
      const View = trigger.ownerDocument.defaultView;
      if (!View || !(event.target instanceof View.Node)) return;
      if (trigger.contains(event.target)) return;
      const content = trigger.ownerDocument.getElementById(popoverId);
      if (content?.contains(event.target)) return;
      onOpenChange(false);
    };
    const doc = trigger.ownerDocument;
    doc.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => doc.removeEventListener("pointerdown", handlePointerDown, { capture: true });
  }, [enabled, isClick, onOpenChange, open, popoverId, triggerRef]);

  const handleHoverClick = () => {
    if (!enabled) return;
    onOpenChange(!open);
  };

  // Touch devices have no hover. Without an explicit handler the passive <span>
  // wrapper would be unreachable on touch. Only touch pointers toggle here —
  // mouse/pen flow through the regular onClick/onMouseEnter handlers below to
  // avoid double-firing.
  const handlePassiveTouchPointerDown: PointerEventHandler<HTMLElement> = (event) => {
    if (!enabled) return;
    // Suppress the focus-open that immediately follows this pointer interaction.
    onTriggerPointerDown();
    if (event.pointerType !== "touch") return;
    onOpenChange(!open);
  };

  const handleHoverPointerDown: PointerEventHandler<HTMLElement> = () => {
    // Suppress the focus-open that immediately follows a pointer interaction so
    // the click toggle owns the open/close decision.
    onTriggerPointerDown();
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
    onPointerDown: handleHoverPointerDown,
    onMouseEnter: onTriggerEnter,
    onMouseLeave: onTriggerLeave,
    onFocus: onTriggerFocus,
    onBlur: onTriggerLeave,
    onClick: handleHoverClick,
    onKeyDown: handleHoverKeyDown,
    tabIndex: enabled ? 0 : undefined,
  };
  const passiveHoverTriggerProps: PopoverTriggerRenderProps = {
    ref: composedRef,
    className: hoverClassName,
    "aria-describedby": open ? popoverId : undefined,
    onPointerDown: handlePassiveTouchPointerDown,
    onMouseEnter: onTriggerEnter,
    onMouseLeave: onTriggerLeave,
    onFocus: onTriggerFocus,
    onBlur: onTriggerLeave,
  };

  const triggerProps = isClick ? clickTriggerProps : interactiveHoverTriggerProps;

  const passiveTriggerProps = isClick ? clickTriggerProps : passiveHoverTriggerProps;

  if (typeof children === "function") return <>{children(triggerProps)}</>;

  if (isValidElement<HoverTriggerElementProps>(children)) {
    const child = children as ReactElement<HoverTriggerElementProps>;
    const isNativeInteractive = isNativeInteractiveElement(child);
    const isButtonLikeHover = usesButtonLikeHoverSemantics(child);
    const buttonType = child.type === "button" ? { type: child.props.type ?? "button" } : {};

    if (isClick && isNativeInteractive) {
      return cloneElement(child, {
        ...buttonType,
        ref: composedRef,
        className: cn(child.props.className, className),
        "aria-expanded": triggerProps["aria-expanded"],
        "aria-haspopup": triggerProps["aria-haspopup"],
        "aria-controls": triggerProps["aria-controls"],
        onClick: mergeHandlers(child.props.onClick, triggerProps.onClick, true),
      });
    }

    if (isClick) {
      const buttonProps = triggerProps satisfies ComponentPropsWithRef<"button">;
      return (
        <button type="button" {...buttonProps}>
          {children}
        </button>
      );
    }

    // Any non-natively-focusable hover trigger needs a tab stop so keyboard/SR
    // users can focus it and reveal the tooltip (WCAG 2.1.1/1.4.13) — not only
    // role="button" children. Native interactive elements already focus.
    const needsTabIndex = enabled && child.props.tabIndex === undefined && !isNativeInteractive;
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
      ref: composedRef,
      className: cn(child.props.className, className),
      role: child.props.role ?? (isClick || isNativeInteractive ? undefined : hoverProps.role),
      "aria-describedby": hoverProps["aria-describedby"],
      onClick: mergeHandlers(child.props.onClick, hoverProps.onClick, true),
      onPointerDown: mergeHandlers(child.props.onPointerDown, hoverProps.onPointerDown),
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
    return (
      <button type="button" {...buttonProps}>
        {children}
      </button>
    );
  }

  const spanProps = passiveTriggerProps satisfies ComponentPropsWithRef<"span">;
  // Plain non-interactive children (e.g. a tooltip on text) need a tab stop so
  // keyboard/SR users can focus the trigger and reveal the tooltip; the disabled
  // native-element wrapper above intentionally stays untabbable.
  return (
    <span {...spanProps} tabIndex={enabled ? 0 : undefined}>
      {children}
    </span>
  );
}
