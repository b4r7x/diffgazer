import { ApiProvider, useConfigCheck, useServerStatus } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import { sanitizeTerminalText } from "@diffgazer/core/review";
import { QueryClientProvider } from "@tanstack/react-query";
import { Box, Text, useInput } from "ink";
import type { ReactElement, ReactNode } from "react";
import { useMemo, useState } from "react";
import type { CliMode } from "../cli-options";
import { GlobalLayout } from "../components/layout/global";
import { isTerminalTooSmall, TerminalTooSmall } from "../components/layout/terminal-too-small";
import { Spinner } from "../components/ui/spinner";
import { ExitPreparationProvider } from "../hooks/use-exit";
import { useNavigation } from "../hooks/use-navigation";
import { useTerminalDimensions } from "../hooks/use-terminal-dimensions";
import { api } from "../lib/api";
import { createCliQueryClient } from "../lib/query-client";
import { createServerFactories } from "../lib/servers/factories";
import type { TerminalInputQueue } from "../lib/terminal-input";
import { CliThemeProvider, useTheme } from "../theme/provider";
import { AppGlobalShortcuts } from "./global-shortcuts";
import { TerminalKeyboardProvider } from "./providers/keyboard";
import { NavigationProvider } from "./providers/navigation";
import { ServerProvider, useServerControls } from "./providers/server";
import { ScreenRouter } from "./router";
import { StartupThemeSync } from "./startup-theme-sync";
import { useConfigGuard } from "./use-config-guard";

const queryClient = createCliQueryClient();

function GateFrame({ children }: { children: ReactNode }): ReactElement {
  const { columns, rows } = useTerminalDimensions();
  if (isTerminalTooSmall(columns, rows)) {
    return <TerminalTooSmall columns={columns} rows={rows} />;
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
        <Text color={tokens.muted}>{sanitizeTerminalText(startupFailure ?? state.message)}</Text>
        <Text color={tokens.muted}>Press r to retry</Text>
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
        <Text color={tokens.muted}>
          {sanitizeTerminalText(
            configCheck.error?.message ?? "Unable to reach the configuration API.",
          )}
        </Text>
        <Text color={tokens.muted}>Press r to retry</Text>
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
