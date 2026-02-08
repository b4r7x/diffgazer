import { createContext, useContext } from "react";

export interface MenuContextValue {
  selectedId: string | null;
  focusedValue: string | null;
  onSelect: (id: string) => void;
  onActivate?: (id: string) => void;
  variant: "default" | "hub";
}

export const MenuContext = createContext<MenuContextValue | undefined>(undefined);

export function useMenuContext(): MenuContextValue {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error("Menu.Item must be used within Menu");
  }
  return context;
}
