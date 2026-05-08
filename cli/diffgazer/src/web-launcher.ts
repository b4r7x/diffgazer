import { printDiffgazerBanner } from "./banner.js";
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

function stopServers(servers: ServerController[]): void {
  for (const server of servers) {
    server.stop();
  }
}

export function startWeb(
  options: WebLauncherOptions,
  dependencies: WebLauncherDependencies = {},
): () => void {
  const resolveServerFactories = dependencies.createServerFactories ?? createModeServerFactories;
  const servers = resolveServerFactories(options).map((create) => create());
  let stopped = false;

  const stop = (): void => {
    if (stopped) {
      return;
    }

    stopped = true;
    stopServers(servers);
  };

  const stopAndExit = (): void => {
    stop();
    setTimeout(() => process.exit(0), 100);
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
    stop();
  };
}
