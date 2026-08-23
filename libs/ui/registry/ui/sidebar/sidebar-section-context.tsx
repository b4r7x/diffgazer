"use client";

import { createContext, useContext } from "react";

export interface SidebarSectionContextValue {
  /**
   * When true, Sidebar.SectionTitle becomes a disclosure toggle that expands/collapses the
   * section.
   */
  collapsible: boolean;
  /** Controlled open state for the section. */
  open: boolean;
  /** Called when an item should toggle. */
  onToggle: () => void;
  /** DOM id for title. */
  titleId: string;
  /** Registers a mounted title rendered through an opaque wrapper. */
  registerTitle: (id: string) => void;
  /** Unregisters a mounted title. */
  unregisterTitle: (id: string) => void;
  /** DOM id for panel. */
  panelId: string;
}

export const SidebarSectionContext = createContext<SidebarSectionContextValue | undefined>(
  undefined,
);

export function useSidebarSectionContext() {
  const context = useContext(SidebarSectionContext);
  if (!context) {
    throw new Error("SidebarSection compound components must be used within a SidebarSection");
  }
  return context;
}
