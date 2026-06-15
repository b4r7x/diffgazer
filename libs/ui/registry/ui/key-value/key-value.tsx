"use client";

import { cva } from "class-variance-authority";
import { type ComponentPropsWithRef, type ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";
import { KeyValueContext, type KeyValueLayout } from "./key-value-context";

/** Class variants for key value. */
export const keyValueVariants = cva("grid", {
  variants: {
    layout: {
      horizontal: "grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-2",
      vertical: "grid-cols-1 gap-y-1",
    },
    bordered: {
      true: "gap-y-0",
      false: "",
    },
  },
  defaultVariants: { layout: "horizontal", bordered: false },
});

/** Props for key value. */
export interface KeyValueProps extends ComponentPropsWithRef<"dl"> {
  /**
   * Horizontal places label and value side-by-side; vertical stacks them. Propagated to
   * KeyValue.Item via context.
   */
  layout?: KeyValueLayout;
  /**
   * Adds row borders and switches items to compact xs sizing. Propagated to KeyValue.Item via
   * context.
   */
  bordered?: boolean;
  /** KeyValue.Item rows rendered inside a semantic <dl>. */
  children: ReactNode;
}

/**
 * Compound component for displaying labeled data. KeyValue wraps one or more KeyValue.Item rows
 * in a semantic description list.
 */
export function KeyValue({
  layout = "horizontal",
  bordered = false,
  children,
  className,
  ref,
  ...props
}: KeyValueProps) {
  const contextValue = useMemo(() => ({ layout, bordered }), [layout, bordered]);

  return (
    <KeyValueContext value={contextValue}>
      <dl
        ref={ref}
        data-slot="key-value"
        className={cn(keyValueVariants({ layout, bordered }), className)}
        {...props}
      >
        {children}
      </dl>
    </KeyValueContext>
  );
}
