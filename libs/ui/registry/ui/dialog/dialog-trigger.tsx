"use client";

import { type ReactNode, type MouseEventHandler, type Ref, type RefCallback } from "react";
import { composeRefs } from "@/lib/compose-refs";
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

  return (
    <button type="button" {...triggerProps}>
      {children}
    </button>
  );
}
