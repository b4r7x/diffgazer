"use client";

import { useCallback, useEffect, useId, useMemo, type ReactNode } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { SidebarContext, type SidebarState } from "./sidebar-context";

export interface SidebarProviderProps {
  state?: SidebarState;
  defaultState?: SidebarState;
  onStateChange?: (state: SidebarState) => void;
  /**
   * Viewport width (in pixels) below which the sidebar collapses into a
   * mobile sheet. Default `1024` (Tailwind `lg`).
   */
  breakpoint?: number;
  /**
   * Keyboard shortcut character (case-insensitive). `Cmd/Ctrl+<key>` cycles
   * `open` ↔ `rail`; `Shift+Cmd/Ctrl+<key>` toggles `hidden`. Pass `null` to
   * disable the hotkey. Default `"b"` (VS Code convention).
   */
  shortcutKey?: string | null;
  children: ReactNode;
}

/**
 * Cookie name for persistence — documented for SSR consumers.
 *
 * The provider intentionally does NOT read or write the cookie. SSR
 * frameworks (TanStack Start, Next.js App Router) should parse the cookie
 * in their route loader and pass the value as `defaultState`, then mirror
 * `onStateChange` writes back via `document.cookie` (`SameSite=Lax`, 1y).
 * Doing the read inside the provider would either cause a hydration
 * mismatch (server snapshot != cookie value) or force every consumer to
 * deal with hidden environment assumptions.
 */
export const SIDEBAR_STATE_COOKIE = "dg_sidebar_state";

/**
 * Minimal editable-target guard for the global Cmd/Ctrl+B hotkey. A more
 * thorough version lives in `@diffgazer/keys` as `isEditableElement` (handles
 * input types, disabled/readOnly, etc.), but the sidebar primitive is meant to
 * install cleanly in copy mode without pulling that full keys/focus surface in
 * just for the hotkey suppression. The hotkey only fires for plain
 * INPUT/TEXTAREA/SELECT/contentEditable targets, which is the realistic typing
 * surface a user wouldn't want to clobber with a sidebar toggle.
 */
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
