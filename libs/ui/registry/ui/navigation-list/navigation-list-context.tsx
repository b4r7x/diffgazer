"use client";

import { createContext, useContext } from "react";

export type NavigationListIndicator = "bar" | "bar-thick" | "arrow" | "bracket";

export interface GroupHeaderRegistration {
  toggle: () => void;
  expanded: boolean;
}

export interface NavigationListContextValue {
  selectedId: string | null;
  highlighted: string | null;
  activate: (id: string) => void;
  highlight: (id: string) => void;
  focusContainer: () => void;
  focused: boolean;
  idPrefix: string;
  indicator: NavigationListIndicator;
  registerGroupHeader: (id: string, registration: GroupHeaderRegistration) => void;
  unregisterGroupHeader: (id: string) => void;
  groupHeaders: Map<string, GroupHeaderRegistration>;
}

export const NavigationListContext = createContext<NavigationListContextValue | undefined>(undefined);

export function useNavigationListContext() {
  const context = useContext(NavigationListContext);
  if (context === undefined) {
    throw new Error("NavigationListItem must be used within NavigationList");
  }
  return context;
}
