"use client";

import { createContext, useContext } from "react";

export interface TabsContextValue {
  tabsId: string;
  value: string;
  onValueChange: (value: string) => void;
  orientation: "horizontal" | "vertical";
  variant: "default" | "underline";
  activationMode: "automatic" | "manual";
}

export const TabsContext = createContext<TabsContextValue | undefined>(undefined);

export function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs compound components must be used within Tabs");
  }
  return context;
}
