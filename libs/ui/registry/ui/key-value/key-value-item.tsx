"use client";

import { cva } from "class-variance-authority";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type KeyValueLayout, type KeyValueVariant, useKeyValueContext } from "./key-value-context";

/** Props for key value item. */
export interface KeyValueItemProps extends Omit<ComponentPropsWithRef<"dt">, "children"> {
  /** Label content rendered in a <dt>. */
  label: ReactNode;
  /** Value content rendered in a <dd>. */
  value: ReactNode;
  /** Color token applied to the value. Info uses monospace; the rest are bold semantic colors. */
  variant?: KeyValueVariant;
  /** Per-row override of the parent layout. */
  layout?: KeyValueLayout;
  /** Per-row override of the parent bordered prop. */
  bordered?: boolean;
  /** Class applied to the <dt> in addition to the variant classes. */
  labelClassName?: string;
  /** Class applied to the <dd> in addition to the variant classes. */
  valueClassName?: string;
}

/** Class variants for label. */
export const labelVariants = cva("text-muted-foreground", {
  variants: {
    bordered: {
      true: "pt-4 border-t border-border first:border-t-0 text-xs",
      false: "text-sm",
    },
  },
  defaultVariants: { bordered: false },
});

/** Class variants for value. */
export const valueVariants = cva("", {
  variants: {
    variant: {
      default: "font-bold text-foreground",
      warning: "font-bold text-warning",
      info: "font-mono text-foreground",
      success: "font-bold text-success",
      error: "font-bold text-error",
    },
    bordered: { true: "text-xs", false: "" },
    layout: {
      horizontal: "text-right",
      vertical: "pb-3",
    },
  },
  compoundVariants: [
    {
      layout: "horizontal",
      bordered: true,
      class: "pt-4 border-t border-border [&:nth-child(2)]:border-t-0",
    },
  ],
  defaultVariants: { variant: "default", bordered: false, layout: "horizontal" },
});

/**
 * Compound component for displaying labeled data. KeyValue wraps one or more KeyValue.Item rows
 * in a semantic description list.
 */
export function KeyValueItem({
  label,
  value,
  variant = "default",
  className,
  labelClassName,
  valueClassName,
  ref,
  layout: layoutProp,
  bordered: borderedProp,
  ...rest
}: KeyValueItemProps) {
  const ctx = useKeyValueContext();
  const layout = layoutProp ?? ctx.layout;
  const bordered = borderedProp ?? ctx.bordered;

  return (
    <>
      <dt
        ref={ref}
        className={cn(labelVariants({ bordered }), className, labelClassName)}
        {...rest}
      >
        {label}
      </dt>
      <dd className={cn(valueVariants({ variant, bordered, layout }), valueClassName)}>{value}</dd>
    </>
  );
}
