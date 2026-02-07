import { createContext, useContext } from "react";

export interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  registerTrigger: (value: string, element: HTMLButtonElement | null) => void;
  getTriggers: () => Map<string, HTMLButtonElement | null>;
  orientation: "horizontal" | "vertical";
}

export const TabsContext = createContext<TabsContextValue | undefined>(undefined);

export function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs compound components must be used within Tabs");
  }
  return context;
}
