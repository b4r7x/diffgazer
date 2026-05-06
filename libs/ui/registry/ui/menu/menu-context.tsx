"use client";

import { createContext, useContext } from "react";

export interface MenuContextValue {
  selectedId: string | null;
  highlightedId: string | null;
  activate: (id: string) => void;
  highlight: (id: string) => void;
  variant: "default" | "hub";
  idPrefix: string;
  itemRole: "menuitem" | "menuitemradio";
}

export const MenuContext = createContext<MenuContextValue | undefined>(undefined);

export function useMenuContext(): MenuContextValue {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error("Menu parts must be used within a Menu");
  }
  return context;
}
