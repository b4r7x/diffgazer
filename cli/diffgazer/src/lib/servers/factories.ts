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
}

export function createDevServerFactories(
  options: ServerFactoryOptions = {},
): Array<() => ServerController> {
  const onReady = createReadyHandler(options.openBrowser);

  return [
    () =>
      createApiServer({
        cwd: config.paths.server,
        port: config.ports.api,
      }),
    () =>
      createWebServer({
        cwd: config.paths.web,
        port: config.ports.web,
        onReady,
      }),
  ];
}

export function createProdServerFactories(
  options: ServerFactoryOptions = {},
): Array<() => ServerController> {
  const projectRoot = findGitRoot(process.cwd());
  return [
    () =>
      createEmbeddedServer({
        port: parsePortEnv(process.env.PORT, config.ports.api),
        projectRoot,
        onReady: createReadyHandler(options.openBrowser),
      }),
  ];
}

export function createServerFactories(
  options: ModeServerFactoryOptions,
): Array<() => ServerController> {
  return options.mode === "dev"
    ? createDevServerFactories({ openBrowser: options.openBrowser })
    : createProdServerFactories({ openBrowser: options.openBrowser });
}
