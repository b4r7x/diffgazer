"use client";

import { type Ref, useId, useMemo } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { cn } from "@/lib/utils";
import { TabsContext } from "./tabs-context";

export interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {
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
  const [value, setValue] = useControllableState<string>({
    value: controlledValue,
    defaultValue: defaultValue ?? "",
    onChange: onValueChange,
  });

  const contextValue = useMemo(
    () => ({ tabsId, value, onValueChange: setValue, orientation, variant, activationMode }),
    [tabsId, value, orientation, variant, activationMode],
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
