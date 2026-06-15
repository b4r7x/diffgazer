"use client";

import { createContext, useContext } from "react";

/** Context value shared by navigation list item. */
export interface NavigationListItemContextValue {
  /** DOM id for label. */
  labelId: string;
  /** DOM id for desc. */
  descId: string;
  /** Whether navigation list item is tree. */
  isTree: boolean;
}

/** React context backing navigation list item. */
export const NavigationListItemContext = createContext<NavigationListItemContextValue | undefined>(
  undefined,
);

/** Reads the navigation list item context. */
export function useNavigationListItemContext() {
  const context = useContext(NavigationListItemContext);
  if (context === undefined) {
    throw new Error("NavigationList.Title/Meta must be used within NavigationList.Item");
  }
  return context;
}
