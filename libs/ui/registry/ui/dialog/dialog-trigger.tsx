"use client";

import {
  cloneElement,
  isValidElement,
  type ComponentPropsWithRef,
  type ReactElement,
  type ReactNode,
  type MouseEventHandler,
  type Ref,
  type RefCallback,
} from "react";
import { composeRefs } from "@/lib/compose-refs";
import { cn } from "@/lib/utils";
import { useDialogContext } from "./dialog-context";

export interface DialogTriggerRenderProps {
  ref: RefCallback<HTMLElement>;
  className?: string;
  "aria-haspopup": "dialog";
  "aria-expanded": boolean;
  "aria-controls": string;
  onClick: MouseEventHandler<HTMLElement>;
}

export interface DialogTriggerProps {
  children: ReactNode | ((props: DialogTriggerRenderProps) => ReactNode);
  className?: string;
  onClick?: MouseEventHandler<HTMLElement>;
  ref?: Ref<HTMLElement>;
}

interface DialogTriggerElementProps {
  ref?: Ref<HTMLElement>;
  className?: string;
  type?: string;
  "aria-haspopup"?: "dialog";
  "aria-expanded"?: boolean;
  "aria-controls"?: string;
  onClick?: MouseEventHandler<HTMLElement>;
}

const nativeInteractiveElements = new Set(["button", "a", "input", "select", "textarea", "summary"]);

function isNativeInteractiveElement(element: ReactElement<DialogTriggerElementProps>): boolean {
  return typeof element.type === "string" && nativeInteractiveElements.has(element.type);
}

function mergeClickHandlers(
  existing: MouseEventHandler<HTMLElement> | undefined,
  added: MouseEventHandler<HTMLElement>,
): MouseEventHandler<HTMLElement> {
  return (event) => {
    existing?.(event);
    if (!event.defaultPrevented) added(event);
  };
}

export function DialogTrigger({ children, className, onClick, ref }: DialogTriggerProps) {
  const { open, onOpenChange, contentId, triggerRef } = useDialogContext();
  const composedRef = composeRefs(triggerRef, ref);

  const handleClick: MouseEventHandler<HTMLElement> = (e) => {
    onClick?.(e);
    if (!e.defaultPrevented) onOpenChange(true);
  };

  const triggerProps: DialogTriggerRenderProps = {
    ref: composedRef,
    className,
    "aria-haspopup": "dialog",
    "aria-expanded": open,
    "aria-controls": contentId,
    onClick: handleClick,
  };

  if (typeof children === "function") return <>{children(triggerProps)}</>;

  if (isValidElement<DialogTriggerElementProps>(children)) {
    const child = children as ReactElement<DialogTriggerElementProps>;
    if (isNativeInteractiveElement(child)) {
      const buttonType = child.type === "button" ? { type: child.props.type ?? "button" } : {};

      return cloneElement(child, {
        ...buttonType,
        ref: composeRefs(composedRef, child.props.ref),
        className: cn(child.props.className, className),
        "aria-haspopup": triggerProps["aria-haspopup"],
        "aria-expanded": triggerProps["aria-expanded"],
        "aria-controls": triggerProps["aria-controls"],
        onClick: mergeClickHandlers(child.props.onClick, triggerProps.onClick),
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
