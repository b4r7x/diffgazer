"use client";

import { createContext, useContext } from "react";

export interface NavigationListContextValue {
  selectedId: string | null;
  highlightedId: string | null;
  activate: (id: string) => void;
  highlight: (id: string) => void;
  focused: boolean;
  idPrefix: string;
}

export const NavigationListContext = createContext<NavigationListContextValue | undefined>(undefined);

export function useNavigationListContext() {
  const context = useContext(NavigationListContext);
  if (context === undefined) {
    throw new Error("NavigationListItem must be used within NavigationList");
  }
  return context;
}
