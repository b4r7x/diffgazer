import { parsePortEnv } from "@diffgazer/core/env";
import type { CliMode } from "../../cli-options";
import { config } from "../../config";
import { createApiServer } from "./api";
import { createReadyHandler } from "./browser-launch";
import { createEmbeddedServer } from "./embedded";
import { findGitRoot } from "./git-root";
import type { ServerController } from "./process";
import { createWebServer } from "./web";

interface ServerFactoryOptions {
  openBrowser?: boolean;
}

interface ModeServerFactoryOptions extends ServerFactoryOptions {
  mode: CliMode;
  /** Dev web mode starts Vite; dev TUI only needs the API child. Defaults to true. */
  includeWebServer?: boolean;
  onStartupFailure?: (message: string) => void;
}

export function createServerFactories(
  options: ModeServerFactoryOptions,
): Array<() => ServerController> {
  const projectRoot = findGitRoot(process.cwd());

  if (options.mode === "dev") {
    const apiPort = parsePortEnv(process.env.PORT, config.ports.api);
    const factories: Array<() => ServerController> = [
      () =>
        createApiServer({
          cwd: config.paths.server,
          port: apiPort,
          projectRoot,
        }),
    ];

    if (options.includeWebServer !== false) {
      const onReady = createReadyHandler(options.openBrowser);
      factories.push(() =>
        createWebServer({
          cwd: config.paths.web,
          port: config.ports.web,
          onReady,
        }),
      );
    }

    return factories;
  }

  return [
    () =>
      createEmbeddedServer({
        port: parsePortEnv(process.env.PORT, config.ports.api),
        projectRoot,
        onReady: createReadyHandler(options.openBrowser),
        onFailure: options.onStartupFailure,
      }),
  ];
}
