import * as React from 'react';

export interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  registerTrigger: (value: string, element: HTMLButtonElement | null) => void;
  getTriggers: () => Map<string, HTMLButtonElement | null>;
}

export const TabsContext = React.createContext<TabsContextValue | undefined>(undefined);

export function useTabsContext() {
  const context = React.useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs compound components must be used within Tabs');
  }
  return context;
}
