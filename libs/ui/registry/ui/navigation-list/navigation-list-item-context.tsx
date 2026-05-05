"use client";

import { createContext, useContext } from "react";

export interface NavigationListItemContextValue {
  labelId: string;
  descId: string;
}

export const NavigationListItemContext = createContext<NavigationListItemContextValue | undefined>(undefined);

export function useNavigationListItemContext() {
  const context = useContext(NavigationListItemContext);
  if (context === undefined) {
    throw new Error("NavigationList.Title/Meta must be used within NavigationList.Item");
  }
  return context;
}
