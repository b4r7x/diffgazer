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

interface ServerFactoryDependencies {
  createApiServer?: typeof createApiServer;
  createEmbeddedServer?: typeof createEmbeddedServer;
  createReadyHandler?: typeof createReadyHandler;
  createWebServer?: typeof createWebServer;
  findGitRoot?: typeof findGitRoot;
  getCwd?: () => string;
}

export function createServerFactories(
  options: ModeServerFactoryOptions,
  dependencies: ServerFactoryDependencies = {},
): Array<() => ServerController> {
  const {
    createApiServer: makeApiServer = createApiServer,
    createEmbeddedServer: makeEmbeddedServer = createEmbeddedServer,
    createReadyHandler: makeReadyHandler = createReadyHandler,
    createWebServer: makeWebServer = createWebServer,
    findGitRoot: resolveGitRoot = findGitRoot,
    getCwd = process.cwd,
  } = dependencies;
  const projectRoot = resolveGitRoot(getCwd());

  if (options.mode === "dev") {
    const apiPort = parsePortEnv(process.env.PORT, config.ports.api);
    const factories: Array<() => ServerController> = [
      () =>
        makeApiServer({
          cwd: config.paths.server,
          port: apiPort,
          projectRoot,
        }),
    ];

    if (options.includeWebServer !== false) {
      const onReady = makeReadyHandler(options.openBrowser);
      factories.push(() =>
        makeWebServer({
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
      makeEmbeddedServer({
        port: parsePortEnv(process.env.PORT, config.ports.api),
        projectRoot,
        onReady: makeReadyHandler(options.openBrowser),
        onFailure: options.onStartupFailure,
      }),
  ];
}
