import { printDiffgazerBanner } from "./banner";
import type { CliMode } from "./cli-options";
import { config } from "./config";
import { reportToTerminal } from "./lib/report-to-terminal";
import { createServerFactories as createModeServerFactories } from "./lib/servers/factories";
import type { ServerController } from "./lib/servers/types";
import { SHUTDOWN_SIGNALS } from "./lib/shutdown-signals";
import { ensureShutdownToken } from "./lib/shutdown-token";
import { stopWithTimeout } from "./lib/stop-with-timeout";

interface WebLauncherOptions {
  mode: CliMode;
  openBrowser: boolean;
}

interface WebLauncherDependencies {
  createServerFactories?: typeof createModeServerFactories;
  ensureShutdownToken?: typeof ensureShutdownToken;
  printBanner?: () => void;
}

export function startWeb(
  options: WebLauncherOptions,
  dependencies: WebLauncherDependencies = {},
): () => Promise<void> {
  const initializeShutdownToken = dependencies.ensureShutdownToken ?? ensureShutdownToken;
  initializeShutdownToken();
  let stopPromise: Promise<void> | null = null;
  let servers: ServerController[] = [];
  let startupFailureHandled = false;

  const stop = (): Promise<void> => {
    if (!stopPromise) {
      stopPromise = stopServers(servers);
    }
    return stopPromise;
  };

  const handleStartupFailure = (message: string): void => {
    if (startupFailureHandled) return;
    startupFailureHandled = true;
    reportToTerminal(message);
    process.exitCode = 1;
    void stopWithTimeout(stop, config.shutdown.gracefulMs).finally(() => {
      process.exit(1);
    });
  };

  const resolveServerFactories = dependencies.createServerFactories ?? createModeServerFactories;

  servers = resolveServerFactories({
    ...options,
    onStartupFailure: handleStartupFailure,
  }).map((create) => create());

  const stopAndExit = (): void => {
    void stopWithTimeout(stop, config.shutdown.gracefulMs).finally(() => {
      process.exit(0);
    });
  };

  for (const signal of SHUTDOWN_SIGNALS) {
    process.once(signal, stopAndExit);
  }

  const printBanner = dependencies.printBanner ?? printDiffgazerBanner;
  printBanner();
  for (const server of servers) {
    void server.start().catch(() => undefined);
  }

  return () => {
    for (const signal of SHUTDOWN_SIGNALS) {
      process.off(signal, stopAndExit);
    }
    return stop();
  };
}

async function stopServers(servers: ServerController[]): Promise<void> {
  await Promise.allSettled(servers.map((server) => server.stop()));
}
