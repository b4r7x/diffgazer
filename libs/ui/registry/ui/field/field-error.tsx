"use client";

import { type ComponentProps, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import { hasRenderableContent, useFieldContext } from "./field-context";

export interface FieldErrorProps extends ComponentProps<"p"> {}

export function FieldError({ className, children, ref, ...props }: FieldErrorProps) {
  const { defaultErrorId, invalid, registerSlot, unregisterSlot } = useFieldContext("Field.Error");
  const hasChildren = hasRenderableContent(children);
  const resolvedId = props.id ?? defaultErrorId;
  const isRendered = hasChildren && invalid;

  useLayoutEffect(() => {
    registerSlot("error", { id: resolvedId, hasContent: isRendered });
    return () => unregisterSlot("error");
  }, [registerSlot, unregisterSlot, resolvedId, isRendered]);

  if (!isRendered) return null;

  return (
    <p
      role="alert"
      {...props}
      ref={ref}
      id={resolvedId}
      data-slot="field-error"
      // The left rule carries the invalid signal without color, so the message
      // still separates from Field.Description for color-blind readers.
      className={cn("border-l border-error pl-2 text-xs text-error", className)}
    >
      {children}
    </p>
  );
}
