import { printDiffgazerBanner } from "./banner.js";
import { ensureShutdownToken } from "./lib/shutdown-token.js";
import type { ServerController } from "./lib/servers/create-process-server.js";
import { createServerFactories as createModeServerFactories } from "./lib/servers/server-factories.js";
import type { CliMode } from "./types/cli.js";

interface WebLauncherOptions {
  mode: CliMode;
  openBrowser: boolean;
}

interface WebLauncherDependencies {
  createServerFactories?: typeof createModeServerFactories;
  printBanner?: () => void;
}

const SHUTDOWN_TIMEOUT_MS = 3000;

export function startWeb(
  options: WebLauncherOptions,
  dependencies: WebLauncherDependencies = {},
): () => Promise<void> {
  ensureShutdownToken();
  const resolveServerFactories = dependencies.createServerFactories ?? createModeServerFactories;
  const servers = resolveServerFactories(options).map((create) => create());
  let stopPromise: Promise<void> | null = null;

  const stop = (): Promise<void> => {
    if (!stopPromise) {
      stopPromise = stopServers(servers);
    }
    return stopPromise;
  };

  const stopAndExit = (): void => {
    void stopWithTimeout(stop, SHUTDOWN_TIMEOUT_MS).finally(() => {
      process.exit(0);
    });
  };

  process.once("SIGINT", stopAndExit);
  process.once("SIGTERM", stopAndExit);

  const printBanner = dependencies.printBanner ?? printDiffgazerBanner;
  printBanner();
  for (const server of servers) {
    server.start();
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

async function stopWithTimeout(
  stop: () => Promise<void>,
  timeoutMs: number,
): Promise<void> {
  const timeout = new Promise<"timeout">((resolve) => {
    setTimeout(() => resolve("timeout"), timeoutMs);
  });
  await Promise.race([stop(), timeout]);
}
