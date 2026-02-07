import { useState, useRef, type ReactNode } from "react";
import { cn } from "../../lib/cn";
import { TabsContext } from "./tabs-context";

export interface TabsProps<T extends string = string> {
  value?: T;
  onValueChange?: (value: T) => void;
  defaultValue?: T;
  orientation?: "horizontal" | "vertical";
  children: ReactNode;
  className?: string;
}

function TabsRoot<T extends string = string>({
  value: controlledValue,
  onValueChange,
  defaultValue = "" as T,
  orientation = "horizontal",
  children,
  className,
}: TabsProps<T>) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue);
  const triggersRef = useRef<Map<string, HTMLButtonElement | null>>(new Map());

  const value = controlledValue !== undefined ? controlledValue : uncontrolledValue;
  const handleValueChange = (v: string) => {
    if (onValueChange) onValueChange(v as T);
    else setUncontrolledValue(v as T);
  };

  const registerTrigger = (triggerValue: string, element: HTMLButtonElement | null) => {
    if (element) {
      triggersRef.current.set(triggerValue, element);
    } else {
      triggersRef.current.delete(triggerValue);
    }
  };

  const getTriggers = () => triggersRef.current;

  const contextValue = {
    value: value as string,
    onValueChange: handleValueChange,
    registerTrigger,
    getTriggers,
    orientation,
  };

  return (
    <TabsContext.Provider value={contextValue}>
      <div
        className={cn("flex flex-col", className)}
        data-orientation={orientation}
      >
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export { TabsRoot as Tabs };
