"use client";

import {
  type LabelHTMLAttributes,
  type MouseEvent as ReactMouseEvent,
  type Ref,
  useLayoutEffect,
} from "react";
import { cn } from "@/lib/utils";
import {
  hasRenderableContent,
  isDisabledControl,
  isLabelableElement,
  useFieldContext,
} from "./field-context";

export interface FieldLabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  ref?: Ref<HTMLLabelElement>;
}

export function FieldLabel({ className, children, ref, id, onClick, ...props }: FieldLabelProps) {
  const {
    controlId,
    required,
    disabled,
    defaultLabelId,
    controlRef,
    registerSlot,
    unregisterSlot,
  } = useFieldContext("Field.Label");
  const hasChildren = hasRenderableContent(children);
  const resolvedId = id ?? defaultLabelId;

  useLayoutEffect(() => {
    registerSlot("label", { id: resolvedId, hasContent: hasChildren });
    return () => unregisterSlot("label");
  }, [registerSlot, unregisterSlot, resolvedId, hasChildren]);

  const handleClick = (event: ReactMouseEvent<HTMLLabelElement>) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    const control = controlRef.current;
    if (control && !isLabelableElement(control)) {
      event.preventDefault();
      if (isDisabledControl(control, disabled)) return;
      control.focus();
      control.click();
    }
  };

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: this forwards clicks to div-based controls; keyboard activation is owned by the control.
    <label
      {...props}
      ref={ref}
      id={resolvedId}
      data-slot="field-label"
      htmlFor={props.htmlFor ?? controlId}
      onClick={handleClick}
      className={cn("text-xs uppercase font-bold text-muted-foreground select-none", className)}
    >
      {children}
      {required && (
        <span className="text-error" aria-hidden="true">
          {" "}
          *
        </span>
      )}
    </label>
  );
}
