'use client';

import { createContext, useContext } from 'react';

// Internal context type with required disabled field
export interface InternalMenuItemData {
  id: string;
  disabled: boolean;
  index: number;
}

export interface MenuContextValue {
  selectedIndex: number;
  onSelect: (index: number) => void;
  onActivate?: (item: InternalMenuItemData) => void;
  items: InternalMenuItemData[];
  variant: 'default' | 'hub';
}

export const MenuContext = createContext<MenuContextValue | null>(null);

export function useMenuContext(): MenuContextValue {
  const context = useContext(MenuContext);
  if (!context) {
    throw new Error('Menu.Item must be used within Menu');
  }
  return context;
}
