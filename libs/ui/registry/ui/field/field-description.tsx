"use client";

import { type ComponentProps, useLayoutEffect } from "react";
import { cn } from "@/lib/utils";
import { hasRenderableContent, useFieldContext } from "./field-context";

export interface FieldDescriptionProps extends ComponentProps<"p"> {}

export function FieldDescription({ className, children, ref, ...props }: FieldDescriptionProps) {
  const { defaultDescriptionId, disabled, errorHasContent, invalid, registerSlot, unregisterSlot } =
    useFieldContext("Field.Description");
  const hasChildren = hasRenderableContent(children);
  const resolvedId = props.id ?? defaultDescriptionId;

  useLayoutEffect(() => {
    registerSlot("description", { id: resolvedId, hasContent: hasChildren });
    return () => unregisterSlot("description");
  }, [registerSlot, unregisterSlot, resolvedId, hasChildren]);

  if (!hasChildren) return null;

  const hidden = invalid && errorHasContent;

  return (
    <p
      {...props}
      ref={ref}
      id={resolvedId}
      data-slot="field-description"
      className={cn(
        // One visible helper slot at a time: while the field is invalid the error takes the row,
        // so field height stops depending on validity and correcting a field does not push it
        // under the user's thumb. `sr-only` rather than `null` — the node keeps its id and its
        // place in aria-describedby, so assistive tech still gets the hint.
        hidden ? "sr-only" : "text-xs text-muted-foreground",
        // Already muted, so disabled adds no opacity — only the forced-colors mark, which
        // opacity cannot carry.
        disabled && "forced-colors:text-[GrayText]",
        className,
      )}
    >
      {children}
    </p>
  );
}
