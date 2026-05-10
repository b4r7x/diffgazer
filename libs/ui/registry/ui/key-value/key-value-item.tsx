"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useKeyValueContext, type KeyValueLayout, type KeyValueVariant } from "./key-value-context";

export interface KeyValueItemProps extends Omit<ComponentPropsWithRef<"dt">, "children"> {
  label: ReactNode;
  value: ReactNode;
  variant?: KeyValueVariant;
  layout?: KeyValueLayout;
  bordered?: boolean;
  labelClassName?: string;
  valueClassName?: string;
}

const labelVariants = cva("text-muted-foreground", {
  variants: {
    layout: {
      horizontal: "",
      vertical: "",
    },
    bordered: {
      true: "pt-4 border-t border-border first:border-t-0 text-xs",
      false: "text-sm",
    },
  },
  defaultVariants: { layout: "horizontal", bordered: false },
});

const valueVariants = cva("", {
  variants: {
    variant: {
      default: "font-bold text-foreground",
      warning: "font-bold text-warning",
      info: "font-mono text-foreground",
      success: "font-bold text-success",
      error: "font-bold text-destructive",
    },
    bordered: { true: "text-xs", false: "" },
    layout: {
      horizontal: "text-right",
      vertical: "pb-3",
    },
  },
  compoundVariants: [
    { layout: "horizontal", bordered: true, class: "pt-4 border-t border-border [&:nth-child(2)]:border-t-0" },
  ],
  defaultVariants: { variant: "default", bordered: false, layout: "horizontal" },
});

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
        className={cn(labelVariants({ layout, bordered }), className, labelClassName)}
        {...rest}
      >
        {label}
      </dt>
      <dd className={cn(valueVariants({ variant, bordered, layout }), valueClassName)}>{value}</dd>
    </>
  );
}
