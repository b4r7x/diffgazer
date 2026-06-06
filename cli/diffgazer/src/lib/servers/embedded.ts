import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Context } from "hono";
import type { ServerController } from "./process";

export interface EmbeddedServerConfig {
  port: number;
  onReady?: (address: string) => void;
  projectRoot?: string;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const webRoot = join(moduleDir, "web");
const indexHtmlPath = join(webRoot, "index.html");

type EmbeddedServerState = "idle" | "starting" | "running" | "stopped";

export function buildHtmlShell(html: string, token: string): { body: string; csp: string } {
  const nonce = randomBytes(16).toString("base64");
  // Escape angle brackets so the serialized value can never terminate the
  // inline <script> element (a </script> or <!-- sequence in the token).
  const serializedToken = JSON.stringify(token).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  const script = `<script nonce="${nonce}">window.__DIFFGAZER_SHUTDOWN_TOKEN__=${serializedToken};</script>`;
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "frame-ancestors 'none'",
    "form-action 'self'",
  ].join("; ");
  return { body: html.replace("</head>", `${script}</head>`), csp };
}

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
    process.env.DIFFGAZER_PACKAGED = "1";

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
      const rawHtml = readFileSync(indexHtmlPath, "utf-8");
      const { body, csp } = buildHtmlShell(rawHtml, token);
      c.header("Content-Security-Policy", csp);
      return c.html(body);
    });
    app.use("/*", serveStatic({ root: webRoot }));

    try {
      server = serve({ fetch: app.fetch, port: config.port, hostname: "127.0.0.1" }, (info) => {
        if (state === "stopped") {
          return;
        }

        state = "running";
        const address = `http://localhost:${info.port}`;
        config.onReady?.(address);
      });

      server.on("error", (err: NodeJS.ErrnoException) => {
        state = "idle";
        if (err.code === "EADDRINUSE") {
          console.error(`Port ${config.port} is already in use. Close the other process or set a different PORT.`);
        } else if (err.code === "EACCES") {
          console.error(`Permission denied binding to port ${config.port}. Try a port above 1024.`);
        } else {
          console.error("Server listen error:", err);
        }
      });
    } catch (err) {
      state = "idle";
      console.error(err);
    }
  }

  return {
    start,
    stop: async () => {
      state = "stopped";
      // Abort in-flight reviews and clear SSE subscribers first so open streams
      // resolve and the HTTP server can drain; otherwise close() never fires its
      // callback while a review stream keeps a connection alive.
      const { shutdownSessions } = await import("@diffgazer/server");
      shutdownSessions();

      if (!server) {
        return;
      }

      const closing = server;
      server = null;
      await new Promise<void>((resolve) => {
        closing.close(() => resolve());
      });
    },
  };
}
