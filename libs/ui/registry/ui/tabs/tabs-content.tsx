"use client";

import type { Ref } from "react";
import { cn } from "@/lib/utils";
import { useTabsContext } from "./tabs-context";

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  ref?: Ref<HTMLDivElement>;
}

export function TabsContent({ value, children, className, ref, ...rest }: TabsContentProps) {
  const { tabsId, value: selectedValue, orientation } = useTabsContext();
  const isActive = selectedValue === value;

  return (
    <div
      ref={ref}
      role="tabpanel"
      id={`${tabsId}-tabpanel-${value}`}
      aria-labelledby={`${tabsId}-tab-${value}`}
      data-state={isActive ? "active" : "inactive"}
      data-orientation={orientation}
      hidden={!isActive}
      tabIndex={isActive ? 0 : undefined}
      className={cn("mt-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-offset-2", className)}
      {...rest}
    >
      {children}
    </div>
  );
}