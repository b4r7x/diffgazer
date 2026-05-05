"use client";

import type { ComponentPropsWithRef, ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useKeyValueContext, type KeyValueLayout, type KeyValueVariant } from "./key-value-context";

export interface KeyValueItemProps extends ComponentPropsWithRef<"div"> {
  label: ReactNode;
  value: ReactNode;
  variant?: KeyValueVariant;
  layout?: KeyValueLayout;
  bordered?: boolean;
}

const keyValueItemVariants = cva("", {
  variants: {
    layout: {
      horizontal: "flex justify-between items-center",
      vertical: "flex flex-col gap-1",
    },
    bordered: {
      true: "py-4 border-b border-border last:border-b-0",
      false: "",
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
  },
  defaultVariants: { variant: "default", bordered: false },
});

export function KeyValueItem({
  label,
  value,
  variant = "default",
  className,
  ref,
  layout: layoutProp,
  bordered: borderedProp,
  ...rest
}: KeyValueItemProps) {
  const ctx = useKeyValueContext();
  const layout = layoutProp ?? ctx.layout;
  const bordered = borderedProp ?? ctx.bordered;

  return (
    <div
      ref={ref}
      className={cn(keyValueItemVariants({ layout, bordered }), className)}
      {...rest}
    >
      <dt className={cn("text-muted-foreground", bordered ? "text-xs" : "text-sm")}>{label}</dt>
      <dd className={valueVariants({ variant, bordered })}>{value}</dd>
    </div>
  );
}
