"use client";

import { createContext, useContext } from "react";

/**
 * Terminal-styled navigation sidebar list with selection, keyboard navigation, and composable
 * item parts.
 */
export type NavigationListIndicator = "bar" | "bar-thick" | "arrow" | "bracket";

/**
 * Terminal-styled navigation sidebar list with selection, keyboard navigation, and composable
 * item parts.
 */
export interface GroupHeaderRegistration {
  /** Toggles the group header registration item. */
  toggle: () => void;
  expanded: boolean;
}

/** Context value shared by navigation list. */
export interface NavigationListContextValue {
  /** Controlled selected item id. */
  selectedId: string | null;
  /** Controlled highlighted (focused) item id. */
  highlighted: string | null;
  /** Activates an item in navigation list. */
  activate: (id: string) => void;
  /** Highlights an item in navigation list. */
  highlight: (id: string) => void;
  /** Moves focus to container. */
  focusContainer: () => void;
  /**
   * When false, removes the active visual treatment from the selected/highlighted item (useful
   * when focus is elsewhere).
   */
  focused: boolean;
  idPrefix: string;
  /** Visual indicator style for the active/selected item. */
  indicator: NavigationListIndicator;
  /** Registers item with navigation list. */
  registerItem: (
    registrationId: string,
    value: string,
    disabled: boolean,
    element: HTMLElement | null,
  ) => void;
  /** Unregisters item from navigation list. */
  unregisterItem: (registrationId: string) => void;
  /** Registers group header with navigation list. */
  registerGroupHeader: (id: string, registration: GroupHeaderRegistration) => void;
  /** Unregisters group header from navigation list. */
  unregisterGroupHeader: (id: string) => void;
  groupHeaders: Map<string, GroupHeaderRegistration>;
}

/** React context backing navigation list. */
export const NavigationListContext = createContext<NavigationListContextValue | undefined>(
  undefined,
);

/** Reads the navigation list context. */
export function useNavigationListContext() {
  const context = useContext(NavigationListContext);
  if (context === undefined) {
    throw new Error("NavigationListItem must be used within NavigationList");
  }
  return context;
}
