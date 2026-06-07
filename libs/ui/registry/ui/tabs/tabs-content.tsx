"use client";

import type { HTMLAttributes, Ref } from "react";
import { cn } from "@/lib/utils";
import { getTabPanelId, getTabTriggerId, useTabsContext } from "./tabs-context";

export interface TabsContentProps<TValue extends string = string>
  extends HTMLAttributes<HTMLDivElement> {
  value: TValue;
  ref?: Ref<HTMLDivElement>;
}

export function TabsContent<TValue extends string = string>({
  value,
  children,
  className,
  ref,
  ...rest
}: TabsContentProps<TValue>) {
  const { tabsId, value: selectedValue, orientation, triggerValues } = useTabsContext();
  const isActive = selectedValue === value;
  const triggerId = triggerValues.includes(value) ? getTabTriggerId(tabsId, value) : undefined;

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
      className={cn(
        "mt-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-foreground focus-visible:outline-offset-2",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
