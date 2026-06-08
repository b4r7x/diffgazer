import type { ReactNode } from "react";
import { CliThemeProvider as SurfaceCliThemeProvider } from "../../theme/provider";

interface CliThemeProviderProps {
  initialTheme?: string;
  children: ReactNode;
}

export function CliThemeProvider({ initialTheme, children }: CliThemeProviderProps) {
  return <SurfaceCliThemeProvider initialTheme={initialTheme}>{children}</SurfaceCliThemeProvider>;
}
