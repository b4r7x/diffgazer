"use client";

import { cva } from "class-variance-authority";
import { type ComponentPropsWithRef, type ReactNode, useMemo } from "react";
import { cn } from "@/lib/utils";
import { KeyValueContext, type KeyValueLayout } from "./key-value-context";

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

export interface KeyValueProps extends ComponentPropsWithRef<"dl"> {
  layout?: KeyValueLayout;
  bordered?: boolean;
  children: ReactNode;
}

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
      <dl ref={ref} className={cn(keyValueVariants({ layout, bordered }), className)} {...props}>
        {children}
      </dl>
    </KeyValueContext>
  );
}
