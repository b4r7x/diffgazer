import type { ReactNode } from "react";
import { useState } from "react";
import { NavigationContext, type NavigationContextValue } from "../../hooks/use-navigation";
import { getBackTarget } from "../../lib/back-navigation";
import type { Route } from "../../lib/routes";

const MAX_STACK_SIZE = 20;

export function NavigationProvider({
  initialRoute,
  children,
}: {
  initialRoute?: Route;
  children: ReactNode;
}) {
  const [route, setRoute] = useState<Route>(initialRoute ?? { screen: "home" });
  const [stack, setStack] = useState<Route[]>([]);

  const navigate = (newRoute: Route) => {
    if (newRoute.screen === "home") {
      setStack([]);
    } else {
      setStack((prev) => [...prev.slice(-(MAX_STACK_SIZE - 1)), route]);
    }
    setRoute(newRoute);
  };

  const goBack = () => {
    const backTarget = getBackTarget(route.screen);
    if (backTarget) {
      setStack([]);
      setRoute(backTarget);
      return;
    }

    const prev = stack.at(-1);
    if (prev) {
      setStack((s) => s.slice(0, -1));
      setRoute(prev);
      return;
    }

    setRoute({ screen: "home" });
  };

  const canGoBack =
    getBackTarget(route.screen) !== null || stack.length > 0 || route.screen !== "home";

  const value: NavigationContextValue = {
    route,
    navigate,
    goBack,
    canGoBack,
  };

  return <NavigationContext value={value}>{children}</NavigationContext>;
}
