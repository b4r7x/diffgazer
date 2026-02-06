import type { ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";
import { ConfigProvider, useConfigContext } from "./config-provider";
import { KeyboardProvider } from "./keyboard-provider";

export { useConfigContext };
export { useTheme } from "@/hooks/use-theme";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <ThemeProvider>
      <ConfigProvider>
        <KeyboardProvider>{children}</KeyboardProvider>
      </ConfigProvider>
    </ThemeProvider>
  );
}
