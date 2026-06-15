import { ApiProvider } from "@diffgazer/core/api/hooks";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { ConfigProvider } from "@/hooks/use-config";
import { ThemeProvider } from "@/hooks/use-theme";
import { api } from "../../lib/api";
import { queryClient } from "../../lib/query-client";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <ThemeProvider>
          <ConfigProvider>
            <KeyboardProvider>{children}</KeyboardProvider>
          </ConfigProvider>
        </ThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
