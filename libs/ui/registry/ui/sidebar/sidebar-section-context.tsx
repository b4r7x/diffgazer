"use client";

import { createContext, useContext } from "react";

export interface SidebarSectionContextValue {
  collapsible: boolean;
  open: boolean;
  onToggle: () => void;
  titleId: string;
}

export const SidebarSectionContext = createContext<SidebarSectionContextValue | undefined>(undefined);

export function useSidebarSectionContext() {
  const context = useContext(SidebarSectionContext);
  if (!context) {
    throw new Error("SidebarSection compound components must be used within a SidebarSection");
  }
  return context;
}

export function useOptionalSidebarSectionContext() {
  return useContext(SidebarSectionContext);
}
