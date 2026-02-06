import { createContext, useContext } from 'react';

export interface NavigationListContextValue {
  selectedId: string | null;
  onSelect: (id: string) => void;
  onActivate?: (id: string) => void;
  isFocused: boolean;
}

export const NavigationListContext = createContext<NavigationListContextValue | undefined>(undefined);

export function useNavigationListContext() {
  const context = useContext(NavigationListContext);
  if (context === undefined) {
    throw new Error('NavigationList.Item must be used within NavigationList');
  }
  return context;
}
