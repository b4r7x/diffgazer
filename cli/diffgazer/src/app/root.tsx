import {
  ApiProvider,
  useConfigCheck,
  useServerStatus,
  useSettings,
} from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import { toSelectableTheme } from "@diffgazer/core/schemas/config";
import { QueryClientProvider } from "@tanstack/react-query";
import { Box, Text, useInput } from "ink";
import type { ReactElement, ReactNode } from "react";
import { useContext, useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { CliMode } from "../cli-options";
import { GlobalLayout, MIN_TERMINAL_COLUMNS, MIN_TERMINAL_ROWS } from "../components/layout/global";
import { Spinner } from "../components/ui/spinner";
import { ExitPreparationProvider, useExit } from "../hooks/use-exit";
import { KeyboardContext } from "../hooks/use-keyboard";
import { useNavigation } from "../hooks/use-navigation";
import { useTerminalDimensions } from "../hooks/use-terminal-dimensions";
import { api } from "../lib/api";
import { createCliQueryClient } from "../lib/query-client";
import { createServerFactories } from "../lib/servers/factories";
import type { TerminalInputQueue } from "../lib/terminal-input";
import { CliThemeProvider, useTheme } from "../theme/provider";
import { TerminalKeyboardProvider } from "./providers/keyboard";
import { NavigationProvider } from "./providers/navigation-provider";
import { ServerProvider, useServerControls } from "./providers/server";
import { ScreenRouter } from "./router";
import { useConfigGuard } from "./use-config-guard";

const queryClient = createCliQueryClient();

function GateFrame({ children }: { children: ReactNode }): ReactElement {
  const { columns, rows } = useTerminalDimensions();
  if (columns < MIN_TERMINAL_COLUMNS || rows < MIN_TERMINAL_ROWS) {
    return (
      <Box width={columns} height={rows} justifyContent="center" alignItems="center">
        <Text>
          Terminal too small ({columns} columns x {rows} rows). Minimum: {MIN_TERMINAL_COLUMNS}{" "}
          columns x {MIN_TERMINAL_ROWS} rows.
        </Text>
      </Box>
    );
  }
  return (
    <Box
      width={columns}
      height={rows}
      overflow="hidden"
      alignItems="center"
      justifyContent="center"
    >
      {children}
    </Box>
  );
}

interface HealthGateProps {
  children: ReactNode;
  startupFailure: string | null;
  onClearStartupFailure: () => void;
}

function HealthGate({
  children,
  startupFailure,
  onClearStartupFailure,
}: HealthGateProps): ReactElement {
  const { tokens } = useTheme();
  const { state, retry } = useServerStatus();
  const { restartServers } = useServerControls();
  const [isRecovering, setIsRecovering] = useState(false);

  useInput(
    (input) => {
      if (input === "r") {
        onClearStartupFailure();
        setIsRecovering(true);
        void restartServers()
          .then(() => retry())
          .catch(() => undefined)
          .finally(() => setIsRecovering(false));
      }
    },
    { isActive: state.status === "error" && !isRecovering },
  );

  if (state.status === "checking" || isRecovering) {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" padding={1}>
        <Spinner label="Connecting to server..." />
      </Box>
    );
  }

  if (state.status === "error") {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" padding={1}>
        <Text color={tokens.error}>
          {startupFailure ? "Server Failed to Start" : "Server Disconnected"}
        </Text>
        <Text dimColor>{sanitizeTerminalText(startupFailure ?? state.message)}</Text>
        <Text dimColor>Press r to retry</Text>
      </Box>
    );
  }

  return <>{children}</>;
}

export function ConfigGate({ children }: { children: ReactNode }): ReactElement {
  const { tokens } = useTheme();
  const configState = useConfigGuard();
  const configCheck = useConfigCheck();
  const { route } = useNavigation();

  useInput(
    (input) => {
      if (input === "r") {
        void configCheck.refetch();
      }
    },
    { isActive: configState === "api-error" },
  );

  if (configState === "checking") {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" padding={1}>
        <Spinner label="Checking configuration..." />
      </Box>
    );
  }

  if (configState === "api-error") {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" padding={1}>
        <Text color={tokens.error}>Configuration Check Failed</Text>
        <Text dimColor>
          {sanitizeTerminalText(
            configCheck.error?.message ?? "Unable to reach the configuration API.",
          )}
        </Text>
        <Text dimColor>Press r to retry</Text>
      </Box>
    );
  }

  if (configState === "not-configured" && route.screen !== "onboarding") {
    return (
      <Box flexDirection="column" alignItems="center" justifyContent="center" padding={1}>
        <Spinner label="Opening onboarding..." />
      </Box>
    );
  }

  return <>{children}</>;
}

export function StartupThemeSync({ explicitTheme }: { explicitTheme?: string }): null {
  const settingsQuery = useSettings();
  const { setTheme } = useTheme();
  const hasApplied = useRef(false);

  useEffect(() => {
    if (explicitTheme || hasApplied.current || !settingsQuery.data?.theme) return;
    hasApplied.current = true;
    setTheme(toSelectableTheme(settingsQuery.data.theme));
  }, [explicitTheme, settingsQuery.data?.theme, setTheme]);

  return null;
}

export function GlobalShortcuts({ onExit }: { onExit: () => void }): null {
  const ctx = useContext(KeyboardContext);
  const { navigate, route } = useNavigation();

  const isGated = route.screen === "onboarding";

  const onKeyboard = useEffectEvent((key: string) => {
    if (isGated) {
      if (key === "q") onExit();
      return;
    }

    switch (key) {
      case "q":
        onExit();
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

export function AppGlobalShortcuts(): ReactElement {
  const { handleExit } = useExit();
  return <GlobalShortcuts onExit={handleExit} />;
}

interface AppProps {
  mode: CliMode;
  theme?: string;
  terminalInputQueue?: TerminalInputQueue;
}

export function App({ mode, theme, terminalInputQueue }: AppProps): ReactElement {
  const [startupFailure, setStartupFailure] = useState<string | null>(null);
  const serverFactories = useMemo(
    () =>
      createServerFactories({
        mode,
        openBrowser: false,
        includeWebServer: false,
        onStartupFailure: setStartupFailure,
      }),
    [mode],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ApiProvider value={api}>
        <CliThemeProvider initialTheme={theme}>
          <TerminalKeyboardProvider terminalInputQueue={terminalInputQueue}>
            <NavigationProvider>
              <FooterProvider>
                <ExitPreparationProvider>
                  <ServerProvider key={mode} servers={serverFactories}>
                    <AppGlobalShortcuts />
                    <GateFrame>
                      <HealthGate
                        startupFailure={startupFailure}
                        onClearStartupFailure={() => setStartupFailure(null)}
                      >
                        <ConfigGate>
                          <StartupThemeSync explicitTheme={theme} />
                          <GlobalLayout>
                            <ScreenRouter />
                          </GlobalLayout>
                        </ConfigGate>
                      </HealthGate>
                    </GateFrame>
                  </ServerProvider>
                </ExitPreparationProvider>
              </FooterProvider>
            </NavigationProvider>
          </TerminalKeyboardProvider>
        </CliThemeProvider>
      </ApiProvider>
    </QueryClientProvider>
  );
}
