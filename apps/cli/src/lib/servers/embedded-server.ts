import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { getErrorMessage } from "@stargazer/core";
import { createApp } from "@stargazer/server";
import type { ServerController } from "./create-process-server.js";
import { createServerStateStore } from "./server-store.js";

export interface EmbeddedServerConfig {
  port: number;
  onReady?: (address: string) => void;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const webRoot = join(moduleDir, "web");

export function createEmbeddedServer(
  config: EmbeddedServerConfig,
): ServerController {
  const store = createServerStateStore();

  let server: ReturnType<typeof serve> | null = null;

  function start(): void {
    if (server) {
      return;
    }

    if (!existsSync(webRoot)) {
      store.setState({
        status: "error",
        address: null,
        error: `Web assets not found at ${webRoot}`,
      });
      return;
    }

    store.setState({ status: "starting", address: null, error: null });

    const app = createApp();
    app.use("/*", serveStatic({ root: webRoot }));

    try {
      server = serve({ fetch: app.fetch, port: config.port }, (info) => {
        const address = `http://localhost:${info.port}`;
        store.setState({ status: "running", address, error: null });
        config.onReady?.(address);
      });
    } catch (err) {
      store.setState({
        status: "error",
        address: null,
        error: getErrorMessage(err, "Failed to start server"),
      });
    }
  }

  return {
    getSnapshot: store.getSnapshot,
    subscribe: store.subscribe,
    start,
    stop: () => {
      if (!server) {
        store.setIdle();
        return;
      }

      server.close();
      server = null;
      store.setIdle();
    },
  };
}
