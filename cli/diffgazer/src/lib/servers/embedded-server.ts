import { existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Context } from "hono";
import { createApp } from "@diffgazer/server";
import type { ServerController } from "./create-process-server.js";

export interface EmbeddedServerConfig {
  port: number;
  onReady?: (address: string) => void;
  projectRoot?: string;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const webRoot = join(moduleDir, "web");

const isSpaNavigationRequest = (c: Context, pathname: string): boolean => {
  const method = c.req.method;
  if (method !== "GET" && method !== "HEAD") {
    return false;
  }

  if (pathname.startsWith("/api/")) {
    return false;
  }

  if (extname(pathname) !== "") {
    return false;
  }

  const accept = c.req.header("accept");
  if (!accept) {
    return false;
  }

  return accept.includes("text/html");
};

export function createEmbeddedServer(
  config: EmbeddedServerConfig,
): ServerController {
  let server: ReturnType<typeof serve> | null = null;

  function start(): void {
    if (server) {
      return;
    }

    if (!existsSync(webRoot)) {
      console.error(`Web assets not found at ${webRoot}`);
      return;
    }

    if (config.projectRoot) {
      process.env.DIFFGAZER_PROJECT_ROOT = config.projectRoot;
    }

    const app = createApp();
    app.use(
      "/*",
      serveStatic({
        root: webRoot,
        rewriteRequestPath: (path, c) =>
          isSpaNavigationRequest(c, path) ? "/index.html" : path,
      }),
    );

    try {
      server = serve({ fetch: app.fetch, port: config.port }, (info) => {
        const address = `http://localhost:${info.port}`;
        config.onReady?.(address);
      });
    } catch (err) {
      console.error(err);
    }
  }

  return {
    start,
    stop: () => {
      if (!server) {
        return;
      }

      server.close();
      server = null;
    },
  };
}
