"use client";

import { type ComponentProps, useId, useLayoutEffect, useRef } from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { cn } from "@/lib/utils";
import { getTabPanelId, getTabTriggerId, useTabsContext } from "./tabs-context";

/** Props for tabs content. */
export interface TabsContentProps<TValue extends string = string> extends ComponentProps<"div"> {
  /** Stable identifier paired with the matching Tabs.Trigger. */
  value: TValue;
}

/** Panel shown when tab is active. */
export function TabsContent<TValue extends string = string>({
  value,
  children,
  className,
  ref,
  ...rest
}: TabsContentProps<TValue>) {
  const {
    tabsId,
    value: selectedValue,
    orientation,
    triggerValues,
    registerPanel,
    unregisterPanel,
  } = useTabsContext();
  const registrationId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const composedRef = useComposedRefs(rootRef, ref);
  const isActive = selectedValue === value;
  const triggerId = triggerValues.includes(value) ? getTabTriggerId(tabsId, value) : undefined;

  useLayoutEffect(() => {
    registerPanel(registrationId, value, false, rootRef.current);
    return () => unregisterPanel(registrationId);
  }, [registerPanel, unregisterPanel, registrationId, value]);

  return (
    <div
      ref={composedRef}
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
