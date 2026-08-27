"use client";

import { cva } from "class-variance-authority";
import type { ComponentPropsWithRef, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { type KeyValueLayout, type KeyValueVariant, useKeyValueContext } from "./key-value-context";

export interface KeyValueItemProps extends Omit<ComponentPropsWithRef<"dt">, "children"> {
  /** Label content rendered in a <dt>. */
  label: ReactNode;
  /** Value content rendered in a <dd>. */
  value: ReactNode;
  /**
   * Optional qualifying copy for the pair, rendered as a second <dd> that spans the full row.
   * Omit it and no element is rendered.
   */
  description?: ReactNode;
  /**
   * Color token applied to the value. Info renders monospace in the info color; the rest are
   * bold semantic colors.
   */
  variant?: KeyValueVariant;
  /** Per-row override of the parent layout. */
  layout?: KeyValueLayout;
  /** Per-row override of the parent bordered prop. */
  bordered?: boolean;
  /** Class applied to the value <dd> in addition to the variant classes. */
  valueClassName?: string;
  /** Class applied to the description <dd> in addition to the variant classes. */
  descriptionClassName?: string;
}

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

export const keyValueDescriptionVariants = cva("text-xs leading-relaxed text-muted-foreground", {
  variants: {
    layout: {
      // The description qualifies the whole pair, so it spans both tracks of the horizontal
      // grid instead of being squeezed into the value column. The vertical grid is a single
      // track and needs no span.
      horizontal: "col-span-2",
      vertical: "",
    },
    // bordered carries no standalone classes but must be declared so the typed call sites can
    // pass it and the compound variant below can match.
    bordered: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    {
      layout: "horizontal",
      bordered: false,
      // Reclaims part of the row gap so a fact reads as one block: the description sits
      // tighter to the pair it describes than to the next pair. The bordered grid has no row
      // gap to reclaim, so the same offset would ride up onto the value.
      class: "-mt-1",
    },
  ],
  defaultVariants: { bordered: false, layout: "horizontal" },
});

export function KeyValueItem({
  label,
  value,
  description,
  variant = "default",
  className,
  valueClassName,
  descriptionClassName,
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
      {description ? (
        <dd className={cn(keyValueDescriptionVariants({ bordered, layout }), descriptionClassName)}>
          {description}
        </dd>
      ) : null}
    </>
  );
}
