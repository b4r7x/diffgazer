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
  /**
   * Color token applied to the value. Info renders monospace in the info color; the rest are
   * bold semantic colors.
   */
  variant?: KeyValueVariant;
  /** Per-row override of the parent layout. */
  layout?: KeyValueLayout;
  /** Per-row override of the parent bordered prop. */
  bordered?: boolean;
  /** Class applied to the <dd> in addition to the variant classes. */
  valueClassName?: string;
}

/** Class variants for label. */
export const keyValueLabelVariants = cva("text-muted-foreground", {
  variants: {
    bordered: {
      true: "pt-4 border-t border-border first:border-t-0 text-xs",
      false: "text-sm",
    },
    // layout carries no standalone classes but must be declared so the typed call
    // sites can pass it and the compound variant below can match.
    layout: {
      horizontal: "",
      vertical: "",
    },
  },
  compoundVariants: [
    {
      layout: "horizontal",
      bordered: true,
      // The label rule has to cross the grid column gutter to meet the value
      // rule, otherwise the row separator renders as two segments with a hole.
      // The negative margin widens the border box by exactly one gutter; the
      // padding keeps the label text where it was.
      class: "pr-6 -mr-6",
    },
  ],
  defaultVariants: { bordered: false, layout: "horizontal" },
});

/** Class variants for value. */
export const keyValueValueVariants = cva("", {
  variants: {
    variant: {
      default: "font-bold text-foreground",
      warning: "font-bold text-warning",
      info: "font-mono text-info",
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

export function KeyValueItem({
  label,
  value,
  variant = "default",
  className,
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
        className={cn(keyValueLabelVariants({ bordered, layout }), className)}
        {...rest}
      >
        {label}
      </dt>
      <dd className={cn(keyValueValueVariants({ variant, bordered, layout }), valueClassName)}>
        {value}
      </dd>
    </>
  );
}
