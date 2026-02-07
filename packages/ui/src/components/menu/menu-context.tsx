import { createContext, useContext } from "react";

export interface InternalMenuItemData<T extends string = string> {
  id: T;
  disabled: boolean;
  index: number;
}

export interface MenuContextValue {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: InternalMenuItemData) => void;
  registerItem: (id: string, data: InternalMenuItemData) => void;
  unregisterItem: (id: string) => void;
  items: Map<string, InternalMenuItemData>;
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
