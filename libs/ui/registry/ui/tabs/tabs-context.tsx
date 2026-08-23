"use client";

import { createContext, useContext } from "react";
import type { SegmentedSize, SegmentedVariant } from "@/lib/segmented-variants";

export function getTabTriggerId(tabsId: string, value: string): string {
  return `${tabsId}-tab-${encodeURIComponent(value)}`;
}

export function getTabPanelId(tabsId: string, value: string): string {
  return `${tabsId}-tabpanel-${encodeURIComponent(value)}`;
}

export interface TabsContextValue {
  tabsId: string;
  /** Controlled active tab value. Pair with onChange. */
  value: string;
  tabbableValue: string;
  /** Fired when the active tab changes. */
  onChange: (value: string) => void;
  onFocusChange: (value: string | null) => void;
  panelValues: string[];
  triggerValues: string[];
  /** Tab list axis. Switches arrow-key navigation direction and aria-orientation. */
  orientation: "horizontal" | "vertical";
  /** Visual style applied to triggers and the list. */
  variant: SegmentedVariant;
  /** Size variant. */
  size: SegmentedSize;
  /** Automatic activates on focus; manual requires Enter or Space. */
  activationMode: "automatic" | "manual";
  /** Registers trigger with tabs. */
  registerTrigger: (
    registrationId: string,
    value: string,
    disabled: boolean,
    element: HTMLElement | null,
  ) => void;
  /** Unregisters trigger from tabs. */
  unregisterTrigger: (registrationId: string) => void;
  /** Registers panel with tabs. */
  registerPanel: (
    registrationId: string,
    value: string,
    disabled: boolean,
    element: HTMLElement | null,
  ) => void;
  /** Unregisters panel from tabs. */
  unregisterPanel: (registrationId: string) => void;
}

export const TabsContext = createContext<TabsContextValue | undefined>(undefined);

export function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs compound components must be used within Tabs");
  }
  return context;
}
