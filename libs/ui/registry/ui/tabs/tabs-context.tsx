"use client";

import { createContext, useContext } from "react";
import type { SegmentedSize, SegmentedVariant } from "@/lib/segmented-variants";

function encodeIdPart(value: string): string {
  return encodeURIComponent(value);
}

export function getTabTriggerId(tabsId: string, value: string): string {
  return `${tabsId}-tab-${encodeIdPart(value)}`;
}

export function getTabPanelId(tabsId: string, value: string): string {
  return `${tabsId}-tabpanel-${encodeIdPart(value)}`;
}

export interface TabsContextValue {
  tabsId: string;
  value: string;
  tabbableValue: string;
  onChange: (value: string) => void;
  onFocusChange: (value: string | null) => void;
  panelValues: string[];
  triggerValues: string[];
  orientation: "horizontal" | "vertical";
  variant: SegmentedVariant;
  size: SegmentedSize;
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
