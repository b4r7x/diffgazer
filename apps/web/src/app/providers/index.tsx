import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiProvider } from "@diffgazer/api/hooks";
import { ThemeProvider } from "./theme-provider";
import { ConfigProvider } from "./config-provider";
import { KeyboardProvider } from "keyscope";
import { api } from "../../lib/api";
import { createWebQueryClient } from "../../lib/query-client";

const queryClient = createWebQueryClient();

export { queryClient };

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
