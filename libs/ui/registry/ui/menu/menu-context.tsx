"use client";

import { createContext, useContext } from "react";

export type CustomActivator = () => void;

export interface MenuContextValue {
  selectedId: string | null;
  highlighted: string | null;
  activate: (id: string) => void;
  highlight: (id: string) => void;
  variant: "default" | "hub";
  idPrefix: string;
  itemRole: "menuitem" | "menuitemradio";
  registerActivator: (id: string, handler: CustomActivator) => void;
  unregisterActivator: (id: string) => void;
}

export const MenuContext = createContext<MenuContextValue | undefined>(undefined);

export function useMenuContext(): MenuContextValue {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error("Menu parts must be used within a Menu");
  }
  return context;
}
