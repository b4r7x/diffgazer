import { ApiProvider, useServerStatus } from "@diffgazer/core/api/hooks";
import { FooterProvider } from "@diffgazer/core/footer";
import {
  CONFIGURATION_ERROR_COPY,
  CREDENTIAL_ERROR_COPY,
  isCredentialSetupError,
} from "@diffgazer/core/review";
import { sanitizeTerminalText } from "@diffgazer/core/sanitize-terminal";
import { BACK_SHORTCUTS, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { QueryClientProvider } from "@tanstack/react-query";
import { Box, useInput } from "ink";
import type { ReactElement, ReactNode } from "react";
import { useMemo, useState } from "react";
import type { CliMode } from "../cli-options";
import { ErrorGatePanel, GateShell } from "../components/layout/error-gate";
import { GlobalLayout } from "../components/layout/global";
import { isTerminalTooSmall, TerminalTooSmall } from "../components/layout/terminal-too-small";
import { Button } from "../components/ui/button";
import { Spinner } from "../components/ui/spinner";
import { useBackHandler } from "../hooks/use-back-handler";
import { useNavigation } from "../hooks/use-navigation";
import { useTerminalDimensions } from "../hooks/use-terminal-dimensions";
import { api } from "../lib/api";
import { createCliQueryClient } from "../lib/query-client";
import { createServerFactories } from "../lib/servers/factories";
import type { TerminalInputQueue } from "../lib/terminal-input";
import type { TuiThemeName } from "../theme/palettes";
import { CliThemeProvider } from "../theme/provider";
import { AppGlobalShortcuts } from "./global-shortcuts";
import { ExitPreparationProvider } from "./providers/exit-preparation";
import { TerminalKeyboardProvider } from "./providers/keyboard";
import { NavigationProvider } from "./providers/navigation";
import { ServerProvider, useServerControls } from "./providers/server";
import { ScreenRouter } from "./router";
import { StartupThemeSync } from "./startup-theme-sync";
import { useConfigGuard } from "./use-config-guard";

const queryClient = createCliQueryClient();

const HEALTH_RETRY_SHORTCUTS: Shortcut[] = [{ key: "r", label: "Retry" }];
const CONFIG_RETRY_SHORTCUTS: Shortcut[] = [{ key: "Enter", label: "Retry" }];

/** Sole owner of the too-small terminal gate; everything below it renders at a usable size. */
export function GateFrame({ children }: { children: ReactNode }): ReactElement {
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
  const { state, latestState, retry } = useServerStatus();
  const { restartServers } = useServerControls();
  const [isRecovering, setIsRecovering] = useState(false);
  const lostConnection = state.status === "connected" && latestState.status === "error";
  const showDisconnect = state.status === "error" || lostConnection;

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
    { isActive: showDisconnect && !isRecovering },
  );

  if (state.status === "checking" || isRecovering) {
    return (
      <GateShell>
        <Spinner label="Connecting to server..." />
      </GateShell>
    );
  }

  let disconnectMessage: string | undefined;
  if (startupFailure) {
    disconnectMessage = startupFailure;
  } else if (state.status === "error") {
    disconnectMessage = state.message;
  } else if (latestState.status === "error") {
    disconnectMessage = latestState.message;
  }

  if (showDisconnect) {
    return (
      <GateShell shortcuts={HEALTH_RETRY_SHORTCUTS}>
        <ErrorGatePanel
          title={
            startupFailure && state.status === "error"
              ? "Server Failed to Start"
              : "Server Disconnected"
          }
          message={sanitizeTerminalText(disconnectMessage ?? "")}
        />
      </GateShell>
    );
  }

  return <>{children}</>;
}

function ConfigGate({ children }: { children: ReactNode }): ReactElement {
  const configGuard = useConfigGuard();
  const configState = configGuard.status;
  const { route, canGoBack } = useNavigation();

  useInput(
    (input) => {
      if (input === "r" || input === " ") {
        configGuard.retry();
      }
    },
    { isActive: configState === "api-error" },
  );
  useBackHandler({ isActive: configState === "api-error" });

  if (configState === "checking") {
    return (
      <GateShell>
        <Spinner label="Checking configuration..." />
      </GateShell>
    );
  }

  if (configState === "api-error") {
    // A credential-caused init failure is a setup condition: the gate reads as
    // a warning-toned reconnect state instead of an error, same actions.
    const isCredential = isCredentialSetupError(configGuard.error);
    return (
      <GateShell
        shortcuts={CONFIG_RETRY_SHORTCUTS}
        rightShortcuts={canGoBack ? BACK_SHORTCUTS : []}
      >
        <ErrorGatePanel
          title={isCredential ? CREDENTIAL_ERROR_COPY.title : CONFIGURATION_ERROR_COPY.title}
          variant={isCredential ? "warning" : "error"}
          message={
            isCredential
              ? CREDENTIAL_ERROR_COPY.body
              : sanitizeTerminalText(
                  configGuard.error?.message ?? "Unable to reach the configuration API.",
                )
          }
        >
          <Box>
            <Button variant="primary" isActive onPress={configGuard.retry}>
              Retry
            </Button>
          </Box>
        </ErrorGatePanel>
      </GateShell>
    );
  }

  if (configState === "not-configured" && route.screen !== "onboarding") {
    return (
      <GateShell>
        <Spinner label="Opening onboarding..." />
      </GateShell>
    );
  }

  return <>{children}</>;
}

interface AppProps {
  mode: CliMode;
  theme?: TuiThemeName;
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
        announceReady: false,
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
