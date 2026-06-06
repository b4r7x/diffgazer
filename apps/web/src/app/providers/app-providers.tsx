import { ApiProvider } from "@diffgazer/core/api/hooks";
import { KeyboardProvider } from "@diffgazer/keys";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api } from "../../lib/api";
import { createWebQueryClient } from "../../lib/query-client";
import { ConfigProvider } from "./config";
import { ThemeProvider } from "./theme";

const queryClient = createWebQueryClient();

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
