"use client";

import { createContext, useContext } from "react";
import type { SidebarVariant } from "./sidebar-variants";

/** Allowed sidebar state values. */
export type SidebarState = "open" | "rail" | "hidden";

/** Context value shared by sidebar. */
export interface SidebarContextValue {
  state: SidebarState;
  /** DOM id for content. */
  contentId: string;
  /** Whether sidebar is mobile. */
  isMobile: boolean;
  /** Called when state change occurs. */
  onStateChange: (state: SidebarState) => void;
  /** Toggles sidebar. */
  toggleSidebar: () => void;
  /** Toggles hidden. */
  toggleHidden: () => void;
}

/** React context backing sidebar. */
export const SidebarContext = createContext<SidebarContextValue | undefined>(undefined);

/** Provides sidebar behavior. */
export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider or Sidebar");
  }
  return context;
}

/** Provides optional sidebar behavior. */
export function useOptionalSidebar() {
  return useContext(SidebarContext);
}

/** Context value shared by sidebar chrome. */
export interface SidebarChromeContextValue {
  /**
   * Visual variant. "caret" reserves a chevron marker slot shown on the active row;
   * "inverted" full-bleeds the active row with bg-foreground; "bar" draws a 2px left edge with
   * a soft fill on active; "terminal" shows the chevron prompt on the active item and draws a
   * 1px hairline left rail with no background fill; "tree" renders bold section headers with
   * stroke-chevron folds and single-hairline connectors (trunk/tick/corner) with a soft active
   * fill. Propagated to items via context and exposed as data-variant on the nav root.
   */
  variant: SidebarVariant;
  /**
   * When true, renders a small intent dot before each item label and derives intent from the
   * item value via the built-in dictionary unless overridden by an explicit intent prop on the
   * item. Color is decoration only (WCAG 1.4.1) - pair with a text/glyph cue.
   */
  autoTone: boolean;
}

/** React context backing sidebar chrome. */
export const SidebarChromeContext = createContext<SidebarChromeContextValue>({
  variant: "caret",
  autoTone: false,
});

/** Provides sidebar chrome behavior. */
export function useSidebarChrome() {
  return useContext(SidebarChromeContext);
}
