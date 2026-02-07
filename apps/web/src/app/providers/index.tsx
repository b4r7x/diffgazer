import type { ReactNode } from "react";
import { ThemeProvider } from "./theme-provider";
import { ConfigProvider } from "./config-provider";
import { KeyboardProvider } from "@stargazer/keyboard";

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
