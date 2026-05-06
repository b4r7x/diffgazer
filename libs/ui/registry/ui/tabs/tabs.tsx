"use client";

import { type HTMLAttributes, type Ref, useCallback, useEffect, useId, useMemo, useState } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { cn } from "@/lib/utils";
import { TabsContext } from "./tabs-context";

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  orientation?: "horizontal" | "vertical";
  variant?: "default" | "underline";
  activationMode?: "automatic" | "manual";
  ref?: Ref<HTMLDivElement>;
}

function TabsRoot({
  value: controlledValue,
  onValueChange,
  defaultValue,
  orientation = "horizontal",
  variant = "default",
  activationMode = "automatic",
  children,
  className,
  ref,
  ...rest
}: TabsProps) {
  const tabsId = useId();
  const [registeredTabs, setRegisteredTabs] = useState<string[]>([]);
  const [value, setValue] = useControllableState<string>({
    value: controlledValue,
    defaultValue: defaultValue ?? "",
    onChange: onValueChange,
  });
  const firstEnabledTab = registeredTabs[0] ?? "";
  const resolvedValue = registeredTabs.includes(value) ? value : firstEnabledTab;

  const registerTab = useCallback((nextValue: string) => {
    setRegisteredTabs((current) => (
      current.includes(nextValue) ? current : [...current, nextValue]
    ));

    return () => {
      setRegisteredTabs((current) => current.filter((item) => item !== nextValue));
    };
  }, []);

  useEffect(() => {
    if (!firstEnabledTab) return;
    if (value && registeredTabs.includes(value)) return;
    setValue(firstEnabledTab);
  }, [firstEnabledTab, registeredTabs, setValue, value]);

  const contextValue = useMemo(
    () => ({
      tabsId,
      value: resolvedValue,
      onValueChange: setValue,
      registerTab,
      orientation,
      variant,
      activationMode,
    }),
    [tabsId, resolvedValue, setValue, registerTab, orientation, variant, activationMode],
  );

  return (
    <TabsContext value={contextValue}>
      <div
        ref={ref}
        className={cn("flex flex-col", className)}
        data-orientation={orientation}
        {...rest}
      >
        {children}
      </div>
    </TabsContext>
  );
}

export { TabsRoot as Tabs };
