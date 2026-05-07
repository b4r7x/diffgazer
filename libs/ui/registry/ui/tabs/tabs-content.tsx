"use client";

import { useEffect, type HTMLAttributes, type Ref } from "react";
import { cn } from "@/lib/utils";
import { getTabPanelId, getTabTriggerId, useTabsContext } from "./tabs-context";

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  ref?: Ref<HTMLDivElement>;
}

export function TabsContent({ value, children, className, ref, ...rest }: TabsContentProps) {
  const { tabsId, value: selectedValue, orientation, triggerValues } = useTabsContext();
  const isActive = selectedValue === value;
  const triggerId = triggerValues.includes(value) ? getTabTriggerId(tabsId, value) : undefined;

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && !triggerId) {
      console.warn(`Tabs.Content value "${value}" has no matching Tabs.Trigger.`);
    }
  }, [triggerId, value]);

  return (
    <div
      ref={ref}
      role="tabpanel"
      id={getTabPanelId(tabsId, value)}
      aria-labelledby={triggerId}
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
