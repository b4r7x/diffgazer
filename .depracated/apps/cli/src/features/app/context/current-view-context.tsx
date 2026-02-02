import { createContext, useContext, type ReactNode } from 'react';
import type { AppView } from '../../../types/index.js';

interface CurrentViewContextValue {
  currentView: AppView;
}

const CurrentViewContext = createContext<CurrentViewContextValue | undefined>(
  undefined
);

interface CurrentViewProviderProps {
  children: ReactNode;
  currentView: AppView;
}

export function CurrentViewProvider({
  children,
  currentView,
}: CurrentViewProviderProps) {
  return (
    <CurrentViewContext.Provider value={{ currentView }}>
      {children}
    </CurrentViewContext.Provider>
  );
}

export function useCurrentView(): AppView {
  const context = useContext(CurrentViewContext);
  if (!context) {
    throw new Error('useCurrentView must be used within CurrentViewProvider');
  }
  return context.currentView;
}
