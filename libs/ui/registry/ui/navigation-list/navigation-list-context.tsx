"use client";

import { createContext, useContext } from "react";

export type NavigationListIndicator = "bar" | "bar-thick" | "arrow" | "bracket";

export interface GroupHeaderRegistration {
  /** Toggles the group header registration item. */
  toggle: () => void;
  expanded: boolean;
}

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
  indicator: NavigationListIndicator;
  registerItem: (
    registrationId: string,
    value: string,
    disabled: boolean,
    element: HTMLElement | null,
  ) => void;
  unregisterItem: (registrationId: string) => void;
  registerGroupHeader: (id: string, registration: GroupHeaderRegistration) => void;
  unregisterGroupHeader: (id: string) => void;
}

export const NavigationListContext = createContext<NavigationListContextValue | undefined>(
  undefined,
);

export function useNavigationListContext() {
  const context = useContext(NavigationListContext);
  if (context === undefined) {
    throw new Error("NavigationListItem must be used within NavigationList");
  }
  return context;
}
