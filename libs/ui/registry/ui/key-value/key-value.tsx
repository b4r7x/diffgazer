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
      <dl
        ref={ref}
        className={cn(
          "grid",
          layout === "horizontal"
            ? "grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-2"
            : "grid-cols-1 gap-y-1",
          bordered && "gap-y-0",
          className,
        )}
        {...props}
      >
        {children}
      </dl>
    </KeyValueContext>
  );
}
