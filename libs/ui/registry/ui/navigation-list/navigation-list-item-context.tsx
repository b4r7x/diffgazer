"use client";

import { createContext, useContext } from "react";

/** Context value shared by navigation list item. */
export interface NavigationListItemContextValue {
  labelId: string;
  /** Prefix the description parts derive their own ids from, never an id itself. */
  descIdPrefix: string;
  isTree: boolean;
}

export const NavigationListItemContext = createContext<NavigationListItemContextValue | undefined>(
  undefined,
);

export function useNavigationListItemContext() {
  const context = useContext(NavigationListItemContext);
  if (context === undefined) {
    throw new Error("NavigationList.Title/Meta must be used within NavigationList.Item");
  }
  return context;
}
