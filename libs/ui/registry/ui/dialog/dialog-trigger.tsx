"use client";

import {
  type ComponentPropsWithRef,
  cloneElement,
  isValidElement,
  type MouseEventHandler,
  type ReactElement,
  type ReactNode,
  type Ref,
  type RefCallback,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { cn } from "@/lib/utils";
import { isNativeInteractiveElement, mergeHandlers } from "../shared/trigger-interop";
import { useDialogContext } from "./dialog-context";

/** Props for dialog trigger render. */
export interface DialogTriggerRenderProps {
  /** Ref forwarded to the underlying element. */
  ref: RefCallback<HTMLElement>;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** ARIA popup type forwarded to the rendered element. */
  "aria-haspopup": "dialog";
  /** ARIA expanded state forwarded to the rendered element. */
  "aria-expanded": boolean;
  /** ID of the element controlled by the rendered element. */
  "aria-controls"?: string;
  /** Called when click occurs. */
  onClick: MouseEventHandler<HTMLElement>;
}

/** Props for dialog trigger. */
export interface DialogTriggerProps {
  /**
   * Trigger button or render function. The render form receives ref, className,
   * aria-haspopup/expanded/controls, and onClick.
   */
  children: ReactNode | ((props: DialogTriggerRenderProps) => ReactNode);
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** Called when click occurs. */
  onClick?: MouseEventHandler<HTMLElement>;
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLElement>;
}

/** Props for dialog trigger element. */
interface DialogTriggerElementProps {
  /** Ref forwarded to the underlying element. */
  ref?: Ref<HTMLElement>;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /** HTML button type forwarded to the rendered trigger. */
  type?: string;
  /** ARIA popup type forwarded to the rendered element. */
  "aria-haspopup"?: "dialog";
  /** ARIA expanded state forwarded to the rendered element. */
  "aria-expanded"?: boolean;
  /** ID of the element controlled by the rendered element. */
  "aria-controls"?: string;
  /** Called when click occurs. */
  onClick?: MouseEventHandler<HTMLElement>;
}

/** Opens the dialog. */
export function DialogTrigger({ children, className, onClick, ref }: DialogTriggerProps) {
  const { open, onOpenChange, contentId, triggerRef } = useDialogContext();
  const childRef = isValidElement<DialogTriggerElementProps>(children)
    ? children.props.ref
    : undefined;
  const composedRef = useComposedRefs(triggerRef, ref, childRef);

  const handleClick: MouseEventHandler<HTMLElement> = (e) => {
    onClick?.(e);
    if (!e.defaultPrevented) onOpenChange(true);
  };

  const triggerProps: DialogTriggerRenderProps = {
    ref: composedRef,
    className,
    "aria-haspopup": "dialog",
    "aria-expanded": open,
    "aria-controls": open ? contentId : undefined,
    onClick: handleClick,
  };

  if (typeof children === "function") return <>{children(triggerProps)}</>;

  if (isValidElement<DialogTriggerElementProps>(children)) {
    const child = children as ReactElement<DialogTriggerElementProps>;
    if (isNativeInteractiveElement(child)) {
      const buttonType = child.type === "button" ? { type: child.props.type ?? "button" } : {};

      return cloneElement(child, {
        ...buttonType,
        ref: composedRef,
        className: cn(child.props.className, className),
        "aria-haspopup": triggerProps["aria-haspopup"],
        "aria-expanded": triggerProps["aria-expanded"],
        "aria-controls": triggerProps["aria-controls"],
        onClick: mergeHandlers(child.props.onClick, triggerProps.onClick, true),
      });
    }
  }

  const buttonProps = triggerProps satisfies ComponentPropsWithRef<"button">;
  return (
    <button type="button" {...buttonProps}>
      {children}
    </button>
  );
}
