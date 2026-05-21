"use client";

import { createContext, useContext } from "react";
import type { SidebarVariant } from "@/lib/sidebar-variants";

export type SidebarState = "open" | "rail" | "hidden";

/**
 * State context owns runtime behaviour (open/rail/hidden, mobile mode, hotkey
 * wiring). Kept separate from the chrome context so a visual-only re-render
 * doesn't churn state consumers.
 */
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

/**
 * Chrome context owns visual style (variant signature, autoTone opt-in). Lives
 * on the Sidebar root so the same Provider can host different chrome flavours
 * (e.g. dual sidebars in one app shell).
 */
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
