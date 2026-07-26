import { createContext, useContext } from "react";
import type { Route } from "../lib/routes";

export interface NavigationContextValue {
  route: Route;
  navigate: (route: Route) => void;
  goBack: () => void;
  canGoBack: boolean;
}

export const NavigationContext = createContext<NavigationContextValue | null>(null);

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return ctx;
}
