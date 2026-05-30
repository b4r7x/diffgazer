"use client";

import { useCallback, useEffect, useId, useMemo, type ReactNode } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { SidebarContext, type SidebarState } from "./sidebar-context";

export interface SidebarProviderProps {
  /**
   * Documented exception to the `value`/`onChange` control convention: the
   * sidebar exposes a tri-state value (`"open" | "rail" | "hidden"`), so the
   * boolean `collapsed`/`onCollapsedChange` shape cannot represent it. `state`
   * and `onStateChange` are the semantic names for this tri-state control.
   */
  state?: SidebarState;
  defaultState?: SidebarState;
  onStateChange?: (state: SidebarState) => void;
  breakpoint?: number;
  shortcutKey?: string | null;
  children: ReactNode;
}

export const SIDEBAR_STATE_COOKIE = "dg_sidebar_state";

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

export function SidebarProvider({
  state: controlledState,
  defaultState = "open",
  onStateChange,
  breakpoint = 1024,
  shortcutKey = "b",
  children,
}: SidebarProviderProps) {
  const sidebarId = useId();
  const [state, setState] = useControllableState<SidebarState>({
    value: controlledState,
    defaultValue: defaultState,
    onChange: onStateChange,
  });
  const isMobile = useIsMobile(breakpoint);

  const toggleSidebar = useCallback(() => {
    setState(prev => (prev === "open" ? "rail" : "open"));
  }, [setState]);

  const toggleHidden = useCallback(() => {
    setState(prev => (prev === "hidden" ? "open" : "hidden"));
  }, [setState]);

  useEffect(() => {
    if (!shortcutKey) return;
    const normalizedKey = shortcutKey.toLowerCase();
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== normalizedKey) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      if (event.shiftKey) {
        toggleHidden();
      } else {
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [shortcutKey, toggleSidebar, toggleHidden]);

  const contextValue = useMemo(
    () => ({
      state,
      contentId: `${sidebarId}-content`,
      isMobile,
      onStateChange: setState,
      toggleSidebar,
      toggleHidden,
    }),
    [state, isMobile, setState, sidebarId, toggleSidebar, toggleHidden],
  );

  return (
    <SidebarContext value={contextValue}>
      {children}
    </SidebarContext>
  );
}
