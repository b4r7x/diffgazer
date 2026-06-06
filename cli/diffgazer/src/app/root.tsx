import { ApiProvider, useServerStatus } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { QueryClientProvider } from "@tanstack/react-query";
import { Box, Text, useInput } from "ink";
import type { ReactElement, ReactNode } from "react";
import { useContext, useEffect, useEffectEvent, useMemo } from "react";
import type { CliMode } from "../cli-options";
import { GlobalLayout } from "../components/layout/global";
import { Spinner } from "../components/ui/spinner";
import { useExit } from "../hooks/use-exit";
import { api } from "../lib/api";
import { createCliQueryClient } from "../lib/query-client";
import { createServerFactories } from "../lib/servers/factories";
import { KeyboardContext, TerminalKeyboardProvider } from "./providers/keyboard";
import { NavigationProvider, useNavigation } from "./providers/navigation-provider";
import { ServerProvider } from "./providers/server";
import { CliThemeProvider } from "./providers/theme";
import { ScreenRouter } from "./router";
import { useConfigGuard } from "./use-config-guard";

const queryClient = createCliQueryClient();

function HealthGate({ children }: { children: ReactNode }): ReactElement {
  const { state, retry } = useServerStatus();

  useInput(
    (input) => {
      if (input === "r") {
        retry().catch(() => {});
      }
    },
    { isActive: state.status === "error" },
  );

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
  const { handleExit } = useExit();

  const isGated = route.screen === "onboarding";

  const onKeyboard = useEffectEvent((key: string) => {
    if (isGated) {
      if (key === "q") handleExit();
      return;
    }

    switch (key) {
      case "q":
        handleExit();
        break;
      case "s":
        if (route.screen !== "settings" && !route.screen.startsWith("settings/")) {
          navigate({ screen: "settings" });
        }
        break;
      case "?":
        if (route.screen !== "help") {
          navigate({ screen: "help" });
        }
        break;
    }
  });

  useEffect(() => {
    if (!ctx) return;

    const unregisterQ = ctx.registerGlobalHandler("q", () => onKeyboard("q"));
    const unregisterS = ctx.registerGlobalHandler("s", () => onKeyboard("s"));
    const unregisterHelp = ctx.registerGlobalHandler("?", () => onKeyboard("?"));

    return () => {
      unregisterQ();
      unregisterS();
      unregisterHelp();
    };
  }, [ctx]);

  return null;
}

interface AppProps {
  mode: CliMode;
  theme?: string;
  openBrowser: boolean;
}

export function App({ mode, theme, openBrowser }: AppProps): ReactElement {
  const serverProviderKey = `${mode}:${openBrowser ? "open" : "closed"}`;
  const serverFactories = useMemo(
    () => createServerFactories({ mode, openBrowser }),
    [mode, openBrowser],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <CliThemeProvider initialTheme={theme}>
          <TerminalKeyboardProvider>
            <NavigationProvider>
              <FooterProvider>
                <ServerProvider key={serverProviderKey} servers={serverFactories}>
                  <GlobalShortcuts />
                  <HealthGate>
                    <ConfigGate>
                      <GlobalLayout>
                        <ScreenRouter />
                      </GlobalLayout>
                    </ConfigGate>
                  </HealthGate>
                </ServerProvider>
              </FooterProvider>
            </NavigationProvider>
          </TerminalKeyboardProvider>
        </CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
