"use client";

import { createContext, useContext } from "react";
import type { SegmentedSize, SegmentedVariant } from "@/lib/segmented-variants";

function encodeIdPart(value: string): string {
  return encodeURIComponent(value);
}

/** Returns tab trigger id. */
export function getTabTriggerId(tabsId: string, value: string): string {
  return `${tabsId}-tab-${encodeIdPart(value)}`;
}

/** Returns tab panel id. */
export function getTabPanelId(tabsId: string, value: string): string {
  return `${tabsId}-tabpanel-${encodeIdPart(value)}`;
}

/** Context value shared by tabs. */
export interface TabsContextValue {
  /** DOM id for tabs. */
  tabsId: string;
  /** Controlled active tab value. Pair with onChange. */
  value: string;
  /** tabbable value. */
  tabbableValue: string;
  /** Fired when the active tab changes. */
  onChange: (value: string) => void;
  /** Called when focus change occurs. */
  onFocusChange: (value: string | null) => void;
  /** panel values. */
  panelValues: string[];
  /** trigger values. */
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

/** React context backing tabs. */
export const TabsContext = createContext<TabsContextValue | undefined>(undefined);

/** Reads the tabs context. */
export function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("Tabs compound components must be used within Tabs");
  }
  return context;
}
