"use client";

import { useMemo, type ComponentPropsWithRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { KeyValueContext, type KeyValueLayout } from "./key-value-context";

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
      <dl ref={ref} className={cn("flex flex-col", className)} {...props}>
        {children}
      </dl>
    </KeyValueContext>
  );
}
