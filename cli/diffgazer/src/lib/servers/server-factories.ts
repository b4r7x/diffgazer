import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import open from "open";
import { getErrorMessage } from "@diffgazer/core/errors";
import { parsePortEnv } from "@diffgazer/core/env";
import { config } from "../../config";
import type { CliMode } from "../../types/cli";
import { createApiServer } from "./api-server";
import type { ServerController } from "./create-process-server";
import { createEmbeddedServer } from "./embedded-server";
import { createWebServer } from "./web-server";

export function findGitRoot(startPath: string): string {
  let current = resolve(startPath);
  while (true) {
    if (existsSync(join(current, ".git"))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) {
      return resolve(startPath);
    }
    current = parent;
  }
}

type BrowserOpener = (address: string) => Promise<unknown>;

interface ServerFactoryOptions {
  openBrowser?: boolean;
}

interface ModeServerFactoryOptions extends ServerFactoryOptions {
  mode: CliMode;
}

export function openBrowserAddress(
  address: string,
  opener: BrowserOpener = open,
): void {
  void Promise.resolve()
    .then(() => opener(address))
    .catch((err: unknown) => {
      console.warn(`Could not open browser at ${address}: ${getErrorMessage(err)}`);
    });
}

export function createReadyHandler(openBrowser = true): (address: string) => void {
  return (address) => {
    console.log(`Diffgazer is running at ${address}`);
    if (openBrowser) {
      openBrowserAddress(address);
    }
  };
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
