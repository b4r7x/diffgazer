"use client";

import { type ComponentProps, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import { hasRenderableContent, useFieldContext } from "./field-context";

export interface FieldDescriptionProps extends ComponentProps<"p"> {}

export function FieldDescription({ className, children, ref, ...props }: FieldDescriptionProps) {
  const { defaultDescriptionId, registerSlot, unregisterSlot } =
    useFieldContext("Field.Description");
  const hasChildren = hasRenderableContent(children);
  const resolvedId = props.id ?? defaultDescriptionId;

  useLayoutEffect(() => {
    registerSlot("description", { id: resolvedId, hasContent: hasChildren });
    return () => unregisterSlot("description");
  }, [registerSlot, unregisterSlot, resolvedId, hasChildren]);

  if (!hasChildren) return null;

  return (
    <p
      {...props}
      ref={ref}
      id={resolvedId}
      data-slot="field-description"
      className={cn("text-xs text-muted-foreground", className)}
    >
      {children}
    </p>
  );
}
