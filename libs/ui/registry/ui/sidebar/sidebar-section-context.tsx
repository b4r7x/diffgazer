"use client";

import { createContext, useContext } from "react";

/** Context value shared by sidebar section. */
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

/** React context backing sidebar section. */
export const SidebarSectionContext = createContext<SidebarSectionContextValue | undefined>(
  undefined,
);

/** Reads the sidebar section context. */
export function useSidebarSectionContext() {
  const context = useContext(SidebarSectionContext);
  if (!context) {
    throw new Error("SidebarSection compound components must be used within a SidebarSection");
  }
  return context;
}

/** Reads the optional sidebar section context. */
export function useOptionalSidebarSectionContext() {
  return useContext(SidebarSectionContext);
}
