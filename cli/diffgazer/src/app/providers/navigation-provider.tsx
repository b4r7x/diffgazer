import type { ReactNode } from "react";
import { NavigationProvider as SurfaceNavigationProvider } from "../../hooks/use-navigation";

export function NavigationProvider({
  initialRoute,
  children,
}: {
  initialRoute?: Parameters<typeof SurfaceNavigationProvider>[0]["initialRoute"];
  children: ReactNode;
}) {
  return (
    <SurfaceNavigationProvider initialRoute={initialRoute}>{children}</SurfaceNavigationProvider>
  );
}
