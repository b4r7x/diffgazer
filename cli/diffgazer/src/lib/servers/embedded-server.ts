import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Context } from "hono";
import type { ServerController } from "./create-process-server.js";

export interface EmbeddedServerConfig {
  port: number;
  onReady?: (address: string) => void;
  projectRoot?: string;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const webRoot = join(moduleDir, "web");
const indexHtmlPath = join(webRoot, "index.html");

type EmbeddedServerState = "idle" | "starting" | "running" | "stopped";

function isHtmlShellPath(pathname: string): boolean {
  return pathname === "/index.html" || extname(pathname) === "";
}

export const isSpaNavigationRequest = (c: Context, pathname: string): boolean => {
  const method = c.req.method;
  if (method !== "GET" && method !== "HEAD") {
    return false;
  }

  if (pathname.startsWith("/api/")) {
    return false;
  }

  if (!isHtmlShellPath(pathname)) {
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
  let state: EmbeddedServerState = "idle";

  function start(): void {
    if (state === "starting" || state === "running") {
      return;
    }

    state = "starting";
    void startServer().catch((err: unknown) => {
      state = "idle";
      console.error(err);
    });
  }

  async function startServer(): Promise<void> {
    if (!existsSync(webRoot)) {
      console.error(`Web assets not found at ${webRoot}`);
      state = "idle";
      return;
    }

    if (config.projectRoot) {
      process.env.DIFFGAZER_PROJECT_ROOT = config.projectRoot;
    }

    const { createApp } = await import("@diffgazer/server");
    if (state === "stopped") {
      return;
    }

    const app = createApp();
    app.get("/*", async (c, next) => {
      const pathname = new URL(c.req.url).pathname;
      if (!isSpaNavigationRequest(c, pathname)) {
        await next();
        return;
      }

      const token = process.env.DIFFGAZER_SHUTDOWN_TOKEN;
      if (!token) {
        throw new Error(
          "DIFFGAZER_SHUTDOWN_TOKEN is required to serve the embedded SPA. Call ensureShutdownToken() before starting the server.",
        );
      }
      const html = readFileSync(indexHtmlPath, "utf-8");
      const script = `<script>window.__DIFFGAZER_SHUTDOWN_TOKEN__=${JSON.stringify(token)};</script>`;
      return c.html(html.replace("</head>", `${script}</head>`));
    });
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
        if (state === "stopped") {
          return;
        }

        state = "running";
        const address = `http://localhost:${info.port}`;
        config.onReady?.(address);
      });
    } catch (err) {
      state = "idle";
      console.error(err);
    }
  }

  return {
    start,
    stop: () => {
      state = "stopped";
      if (!server) {
        return Promise.resolve();
      }

      const closing = server;
      server = null;
      return new Promise<void>((resolve) => {
        closing.close(() => resolve());
      });
    },
  };
}
