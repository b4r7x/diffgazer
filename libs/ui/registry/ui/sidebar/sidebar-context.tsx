"use client";

import { createContext, useContext } from "react";
import type { SidebarVariant } from "@/lib/sidebar-variants";

export type SidebarState = "open" | "rail" | "hidden";

export interface SidebarContextValue {
  state: SidebarState;
  contentId: string;
  isMobile: boolean;
  onStateChange: (state: SidebarState) => void;
  toggleSidebar: () => void;
  toggleHidden: () => void;
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

export interface SidebarChromeContextValue {
  variant: SidebarVariant;
  autoTone: boolean;
}

export const SidebarChromeContext = createContext<SidebarChromeContextValue>({
  variant: "caret",
  autoTone: false,
});

export function useSidebarChrome() {
  return useContext(SidebarChromeContext);
}
