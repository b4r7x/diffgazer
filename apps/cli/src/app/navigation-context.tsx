import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Route, ScreenName } from "./routes.js";
import { getBackTarget } from "../lib/back-navigation.js";

const MAX_STACK_SIZE = 20;

export interface NavigationContextValue {
  route: Route;
  navigate: (route: Route) => void;
  goBack: () => void;
  canGoBack: boolean;
}

export const NavigationContext = createContext<NavigationContextValue | null>(
  null,
);

export function NavigationProvider({
  initialRoute,
  children,
}: {
  initialRoute?: Route;
  children: ReactNode;
}) {
  const [route, setRoute] = useState<Route>(initialRoute ?? { screen: "home" });
  const [stack, setStack] = useState<Route[]>([]);

  const navigate = useCallback((newRoute: Route) => {
    setStack((prev) => [...prev.slice(-(MAX_STACK_SIZE - 1)), route]);
    setRoute(newRoute);
  }, [route]);

  const goBack = useCallback(() => {
    const backTarget = getBackTarget(route.screen);
    if (backTarget) {
      setRoute(backTarget);
      return;
    }

    if (stack.length > 0) {
      const prev = stack[stack.length - 1]!;
      setStack((s) => s.slice(0, -1));
      setRoute(prev);
      return;
    }

    setRoute({ screen: "home" });
  }, [route.screen, stack]);

  const canGoBack =
    getBackTarget(route.screen) !== null ||
    stack.length > 0 ||
    route.screen !== "home";

  const value = useMemo<NavigationContextValue>(() => ({
    route,
    navigate,
    goBack,
    canGoBack,
  }), [route, navigate, goBack, canGoBack]);

  return (
    <NavigationContext value={value}>
      {children}
    </NavigationContext>
  );
}

export function useNavigation(): NavigationContextValue {
  const ctx = useContext(NavigationContext);
  if (!ctx) {
    throw new Error("useNavigation must be used within a NavigationProvider");
  }
  return ctx;
}
