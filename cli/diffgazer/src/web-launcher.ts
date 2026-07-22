import { printDiffgazerBanner } from "./banner";
import type { CliMode } from "./cli-options";
import { config } from "./config";
import { createServerFactories as createModeServerFactories } from "./lib/servers/factories";
import type { ServerController } from "./lib/servers/controller";
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
    console.error(message);
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

  process.once("SIGINT", stopAndExit);
  process.once("SIGTERM", stopAndExit);

  const printBanner = dependencies.printBanner ?? printDiffgazerBanner;
  printBanner();
  for (const server of servers) {
    void server.start().catch(() => undefined);
  }

  return () => {
    process.off("SIGINT", stopAndExit);
    process.off("SIGTERM", stopAndExit);
    return stop();
  };
}

async function stopServers(servers: ServerController[]): Promise<void> {
  await Promise.allSettled(servers.map((server) => server.stop()));
}
