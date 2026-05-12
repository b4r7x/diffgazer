"use client";

import { createContext, useContext } from "react";

export interface SidebarContextValue {
  open: boolean;
  contentId: string;
  onOpenChange: (open: boolean) => void;
  toggleSidebar: () => void;
}

export const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider or Sidebar");
  }
  return context;
}

export function useOptionalSidebar() {
  return useContext(SidebarContext);
}
