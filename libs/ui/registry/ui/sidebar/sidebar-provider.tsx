"use client";

import { isEditableElement } from "@diffgazer/keys";
import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef } from "react";
import { useControllableState } from "@/hooks/use-controllable-state";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { SidebarContext, type SidebarState } from "./sidebar-context";

export interface SidebarProviderProps {
  /**
   * Documented exception to the `value`/`onChange` control convention: the sidebar exposes a
   * tri-state value (`"open" | "rail" | "hidden"`), so the boolean
   * `collapsed`/`onCollapsedChange` shape cannot represent it. `state` and `onStateChange` are
   * the semantic names for this tri-state control.
   */
  state?: SidebarState;
  /** Initial visibility state for uncontrolled use. */
  defaultState?: SidebarState;
  /** Fired when the visibility state changes (controlled and uncontrolled). */
  onStateChange?: (state: SidebarState) => void;
  /**
   * Viewport width (px) below which the sidebar collapses into a mobile sheet. Default matches
   * Tailwind lg.
   */
  breakpoint?: number;
  /**
   * Case-insensitive hotkey. Cmd/Ctrl+<key> cycles open ↔ rail; Shift+Cmd/Ctrl+<key> toggles
   * hidden. Pass null to disable.
   */
  shortcutKey?: string | null;
  /** Sidebar and main content that need access to the state via useSidebar(). */
  children: ReactNode;
}

export const SIDEBAR_STATE_COOKIE = "dg_sidebar_state";

// keys' isEditableElement excludes <select>; the shortcut must still defer to a
// focused select. HTMLSelectElement is resolved via the target's ownerDocument
// so cross-document focus works.
function isShortcutEditableTarget(target: EventTarget | null): boolean {
  if (isEditableElement(target)) return true;
  const view = (target as { ownerDocument?: Document } | null)?.ownerDocument?.defaultView;
  return Boolean(view && target instanceof view.HTMLSelectElement);
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
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [state, setState] = useControllableState<SidebarState>({
    value: controlledState,
    defaultValue: defaultState,
    onChange: onStateChange,
  });
  const isMobile = useIsMobile(breakpoint);

  const toggleSidebar = useCallback(() => {
    setState((prev) => (prev === "open" ? "rail" : "open"));
  }, [setState]);

  const toggleHidden = useCallback(() => {
    setState((prev) => (prev === "hidden" ? "open" : "hidden"));
  }, [setState]);

  useEffect(() => {
    if (!shortcutKey) return;
    const view = anchorRef.current?.ownerDocument.defaultView;
    if (!view) return;
    const normalizedKey = shortcutKey.toLowerCase();
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== normalizedKey) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      // Shadow DOM retargets event.target to the host on the window listener;
      // composedPath()[0] is the real inner target so a focused input/select in
      // an open shadow tree still defers the shortcut.
      const target = event.composedPath()[0] ?? event.target;
      if (isShortcutEditableTarget(target)) return;
      event.preventDefault();
      if (event.shiftKey) {
        toggleHidden();
      } else {
        toggleSidebar();
      }
    };
    view.addEventListener("keydown", handler);
    return () => view.removeEventListener("keydown", handler);
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
      {/* Anchor: resolves the owning window so the shortcut listener binds to
          the sidebar's ownerDocument.defaultView, not the top-level window. */}
      <span ref={anchorRef} hidden aria-hidden="true" />
      {children}
    </SidebarContext>
  );
}
