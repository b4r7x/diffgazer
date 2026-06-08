import type { ReactNode } from "react";
import { ThemeProvider as SurfaceThemeProvider } from "@/hooks/use-theme";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <SurfaceThemeProvider>{children}</SurfaceThemeProvider>;
}
