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
import { mergeIds } from "@/lib/aria";
import { cn } from "@/lib/utils";
import { isNativeInteractiveElement, mergeHandlers } from "../shared/trigger-interop";
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
  "aria-labelledby"?: string;
  "aria-hidden"?: boolean;
  id?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  onPointerDown?: PointerEventHandler<HTMLElement>;
  onMouseEnter?: MouseEventHandler<HTMLElement>;
  onMouseLeave?: MouseEventHandler<HTMLElement>;
  onFocus?: FocusEventHandler<HTMLElement>;
  onBlur?: FocusEventHandler<HTMLElement>;
  onKeyDown?: KeyboardEventHandler<HTMLElement>;
  disabled?: boolean;
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
    onTriggerBlur,
    onTriggerClick,
    onTriggerPointerDown,
    markDismissed,
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

  // Tap/focus-opened hover popovers have no hover-leave; dismiss on any
  // pointerdown outside the trigger and portaled content.
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
      markDismissed();
      onOpenChange(false);
    };
    const doc = trigger.ownerDocument;
    doc.addEventListener("pointerdown", handlePointerDown, { capture: true });
    return () => doc.removeEventListener("pointerdown", handlePointerDown, { capture: true });
  }, [enabled, isClick, markDismissed, onOpenChange, open, popoverId, triggerRef]);

  const handleHoverClick = () => {
    if (!enabled) return;
    if (open) markDismissed();
    onOpenChange(!open);
  };

  // Touch has no hover, so the passive <span> wrapper needs an explicit toggle.
  // Only touch toggles here; mouse/pen go through onClick/onMouseEnter to avoid
  // double-firing.
  const handlePassiveTouchPointerDown: PointerEventHandler<HTMLElement> = (event) => {
    if (!enabled) return;
    onTriggerPointerDown();
    if (event.pointerType !== "touch") return;
    if (open) markDismissed();
    onOpenChange(!open);
  };

  const handleHoverPointerDown: PointerEventHandler<HTMLElement> = () => {
    // Suppress the focus-open that follows a pointer so the click toggle owns it.
    onTriggerPointerDown();
  };

  const handleHoverKeyDown: KeyboardEventHandler<HTMLElement> = (event) => {
    if (!enabled) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    if (open) markDismissed();
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
    onBlur: onTriggerBlur,
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
    onBlur: onTriggerBlur,
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
      const childId = child.props.id ?? `${popoverId}-trigger`;
      return (
        // biome-ignore lint/a11y/useAriaPropsSupportedByRole: the neutral wrapper is the only focus path for a disabled native control and receives its name from that control.
        <span
          {...spanProps}
          aria-label={child.props["aria-label"]}
          aria-labelledby={
            child.props["aria-label"] ? undefined : (child.props["aria-labelledby"] ?? childId)
          }
          tabIndex={enabled ? 0 : undefined}
        >
          {cloneElement(child, {
            id: childId,
            className: cn(child.props.className, className),
            "aria-describedby": mergeIds(
              child.props["aria-describedby"],
              passiveTriggerProps["aria-describedby"],
            ),
          })}
        </span>
      );
    }

    const hoverProps = isButtonLikeHover ? triggerProps : passiveTriggerProps;

    return cloneElement(child, {
      ref: composedRef,
      className: cn(child.props.className, className),
      role: child.props.role ?? (isClick || isNativeInteractive ? undefined : hoverProps.role),
      "aria-describedby": mergeIds(child.props["aria-describedby"], hoverProps["aria-describedby"]),
      onClick: mergeHandlers(child.props.onClick, hoverProps.onClick, true),
      onPointerDown: mergeHandlers(child.props.onPointerDown, hoverProps.onPointerDown, true),
      onMouseEnter: mergeHandlers(child.props.onMouseEnter, hoverProps.onMouseEnter),
      onMouseLeave: mergeHandlers(child.props.onMouseLeave, hoverProps.onMouseLeave),
      onFocus: mergeHandlers(child.props.onFocus, hoverProps.onFocus),
      onBlur: mergeHandlers(child.props.onBlur, hoverProps.onBlur),
      onKeyDown: isNativeInteractive
        ? child.props.onKeyDown
        : mergeHandlers(child.props.onKeyDown, hoverProps.onKeyDown, true),
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
  // keyboard/SR users can focus the trigger and reveal the tooltip.
  return (
    <span {...spanProps} tabIndex={enabled ? 0 : undefined}>
      {children}
    </span>
  );
}
