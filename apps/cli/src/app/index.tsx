import { useContext, useEffect } from "react";
import type { ReactElement, ReactNode } from "react";
import { Box, Text, useInput } from "ink";
import { QueryClientProvider } from "@tanstack/react-query";
import { ApiProvider } from "@diffgazer/api/hooks";
import type { CliMode } from "../types/cli.js";
import { CliThemeProvider } from "../theme/theme-context.js";
import { TerminalKeyboardProvider, KeyboardContext } from "./providers/keyboard-provider.js";
import { NavigationProvider, useNavigation } from "./navigation-context.js";
import { FooterProvider } from "./providers/footer-provider.js";
import { ServerProvider } from "./providers/server-provider.js";
import { GlobalLayout } from "../components/layout/global-layout.js";
import { ScreenRouter } from "./router.js";
import { Toaster } from "../components/ui/toast.js";
import { Spinner } from "../components/ui/spinner.js";
import { devServerFactories } from "./modes/dev.js";
import { prodServerFactories } from "./modes/prod.js";
import { useServerStatus } from "@diffgazer/api/hooks";
import { useConfigGuard } from "../hooks/use-config-guard.js";
import { api } from "../lib/api.js";
import { createCliQueryClient } from "../lib/query-client.js";

const queryClient = createCliQueryClient();

function HealthGate({ children }: { children: ReactNode }): ReactElement {
  const { state, retry } = useServerStatus();

  useInput((input) => {
    if (input === "r" && state.status === "error") {
      void retry();
    }
  });

  if (state.status === "checking") {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" padding={1}>
        <Spinner label="Connecting to server..." />
      </Box>
    );
  }

  if (state.status === "error") {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" padding={1}>
        <Text color="red">Server Disconnected</Text>
        <Text dimColor>{state.message}</Text>
        <Text dimColor>Press r to retry</Text>
      </Box>
    );
  }

  return <>{children}</>;
}

function ConfigGate({ children }: { children: ReactNode }): ReactElement {
  const configState = useConfigGuard();

  if (configState === "checking") {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" padding={1}>
        <Spinner label="Checking configuration..." />
      </Box>
    );
  }

  return <>{children}</>;
}

function GlobalShortcuts(): null {
  const ctx = useContext(KeyboardContext);
  const { navigate, route } = useNavigation();

  useEffect(() => {
    if (!ctx) return;

    const unregisterQ = ctx.registerGlobalHandler("q", () => {
      process.exit(0);
    });

    const unregisterS = ctx.registerGlobalHandler("s", () => {
      if (route.screen !== "settings" && !route.screen.startsWith("settings/")) {
        navigate({ screen: "settings" });
      }
    });

    const unregisterHelp = ctx.registerGlobalHandler("?", () => {
      if (route.screen !== "help") {
        navigate({ screen: "help" });
      }
    });

    return () => {
      unregisterQ();
      unregisterS();
      unregisterHelp();
    };
  }, [route.screen]);

  return null;
}

interface AppProps {
  mode: CliMode;
  theme?: string;
}

export function App({ mode, theme }: AppProps): ReactElement {
  const serverFactories =
    mode === "dev" ? devServerFactories : prodServerFactories;

  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <CliThemeProvider initialTheme={theme}>
          <TerminalKeyboardProvider>
            <NavigationProvider>
              <FooterProvider>
                <ServerProvider servers={serverFactories}>
                  <GlobalShortcuts />
                  <HealthGate>
                    <ConfigGate>
                      <GlobalLayout>
                        <ScreenRouter />
                      </GlobalLayout>
                    </ConfigGate>
                  </HealthGate>
                  <Toaster />
                </ServerProvider>
              </FooterProvider>
            </NavigationProvider>
          </TerminalKeyboardProvider>
        </CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
