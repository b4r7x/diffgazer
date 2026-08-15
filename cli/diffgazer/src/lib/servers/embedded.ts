import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SHUTDOWN_TOKEN_GLOBAL } from "@diffgazer/core/api/protocol";
import { getErrorMessage } from "@diffgazer/core/errors";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import type { Context } from "hono";
import { reportToTerminal } from "../report-to-terminal";
import type { ServerController } from "./types";

export interface EmbeddedServerConfig {
  port: number;
  /** Override the packaged SPA root (defaults to `web/` beside the embedded server module). */
  webRoot?: string;
  onReady?: (address: string) => void;
  onFailure?: (message: string) => void;
  projectRoot?: string;
}

const moduleDir = dirname(fileURLToPath(import.meta.url));
const webRoot = join(moduleDir, "web");

/**
 * The SPA ships one parser-blocking inline script of its own (the pre-paint
 * theme bootstrap in `apps/web/index.html`). This CSP admits inline scripts
 * only by nonce, so the placeholder it carries is filled with the same nonce.
 */
const CSP_NONCE_PLACEHOLDER = "{{cspNonce}}";

export function buildHtmlShell(html: string, token: string): { body: string; csp: string } {
  const nonce = randomBytes(16).toString("base64");
  // Escape angle brackets so the serialized value can never terminate the
  // inline <script> element (a </script> or <!-- sequence in the token).
  const serializedToken = JSON.stringify(token).replace(/</g, "\\u003c").replace(/>/g, "\\u003e");
  const script = `<script nonce="${nonce}">window.${SHUTDOWN_TOKEN_GLOBAL}=${serializedToken};</script>`;
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
  const body = html.replaceAll(CSP_NONCE_PLACEHOLDER, nonce).replace("</head>", `${script}</head>`);
  return { body, csp };
}

function isHtmlShellPath(pathname: string): boolean {
  return pathname === "/index.html" || extname(pathname) === "";
}

function describeListenError(err: NodeJS.ErrnoException, port: number): string {
  if (err.code === "EADDRINUSE") {
    return `Port ${port} is already in use. Close the other process or set a different PORT.`;
  }
  if (err.code === "EACCES") {
    return `Permission denied binding to port ${port}. Try a port above 1024.`;
  }
  return `Server listen error: ${err.message}`;
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

export function createEmbeddedServer(config: EmbeddedServerConfig): ServerController {
  let server: ReturnType<typeof serve> | null = null;
  let startPromise: Promise<void> | null = null;
  let resolveStart: (() => void) | null = null;
  let rejectStart: ((error: Error) => void) | null = null;
  // Bumped by stop(). A startup suspended across an await compares the generation
  // it began in, so a stop-then-start sequence retires it instead of letting it
  // bind the port a second start() now owns.
  let lifecycleVersion = 0;

  function rejectStartup(error: Error): void {
    rejectStart?.(error);
    resolveStart = null;
    rejectStart = null;
    startPromise = null;
  }

  function failStartup(message: string, cause?: unknown): void {
    // One owner per diagnostic: the coordinator logs when it supplies `onFailure`.
    if (config.onFailure) {
      config.onFailure(message);
    } else {
      reportToTerminal(message);
    }
    rejectStartup(new Error(message, cause === undefined ? undefined : { cause }));
  }

  function start(): Promise<void> {
    if (startPromise) return startPromise;

    const version = lifecycleVersion;
    const starting = new Promise<void>((resolve, reject) => {
      resolveStart = resolve;
      rejectStart = reject;
    });
    startPromise = starting;
    void starting.catch(() => undefined);
    void startServer(version).catch((err: unknown) => {
      if (version !== lifecycleVersion) return;
      failStartup(getErrorMessage(err), err);
    });
    return starting;
  }

  async function startServer(version: number): Promise<void> {
    const isRetired = () => version !== lifecycleVersion;
    const assetRoot = config.webRoot ?? webRoot;
    const shellPath = join(assetRoot, "index.html");

    if (!existsSync(assetRoot)) {
      failStartup(`Web assets not found at ${assetRoot}`);
      return;
    }

    // The shell ships inside the bundle beside this module and cannot change while
    // the server runs, so it is read once instead of on every SPA navigation.
    const rawHtml = readFileSync(shellPath, "utf-8");

    if (config.projectRoot) {
      process.env.DIFFGAZER_PROJECT_ROOT = config.projectRoot;
    }
    process.env.DIFFGAZER_PACKAGED = "1";

    const { createApp, startSessionMaintenance } = await import("@diffgazer/server");
    if (isRetired()) {
      return;
    }

    startSessionMaintenance();
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
      const { body, csp } = buildHtmlShell(rawHtml, token);
      c.header("Content-Security-Policy", csp);
      // The shell inlines the per-run shutdown token; keep it out of the disk cache.
      c.header("Cache-Control", "no-store");
      return c.html(body);
    });
    app.use("/*", serveStatic({ root: assetRoot }));

    try {
      server = serve({ fetch: app.fetch, port: config.port, hostname: "127.0.0.1" }, (info) => {
        if (isRetired()) {
          return;
        }

        const address = `http://localhost:${info.port}`;
        config.onReady?.(address);
        resolveStart?.();
        resolveStart = null;
        rejectStart = null;
      });

      server.on("error", (err: NodeJS.ErrnoException) => {
        if (isRetired()) return;
        failStartup(describeListenError(err, config.port), err);
      });
    } catch (err) {
      failStartup(getErrorMessage(err), err);
    }
  }

  return {
    start,
    stop: async () => {
      lifecycleVersion += 1;
      if (rejectStart) rejectStartup(new Error("Server stopped before readiness"));
      startPromise = null;
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
