import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { safeTokenMatch } from "./shared/lib/crypto.js";
import { errorResponse } from "./shared/lib/http/response.js";
import { log } from "./shared/lib/log.js";
import { requestLogger, REQUEST_ID_HEADER, type RequestLoggerEnv } from "./shared/middlewares/request-logger.js";
import { healthRouter } from "./features/health/router.js";
import { configRouter } from "./features/config/router.js";
import { settingsRouter } from "./features/settings/router.js";
import { gitRouter } from "./features/git/router.js";
import { reviewRouter } from "./features/review/router.js";
import { shutdownRouter } from "./features/shutdown/router.js";

const isPackaged = (): boolean =>
  process.env.DIFFGAZER_PACKAGED === "1";

const isLocalhostOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  } catch {
    return false;
  }
};

const isSameOrigin = (origin: string, hostHeader: string | undefined): boolean => {
  if (!hostHeader) return false;
  try {
    const url = new URL(origin);
    const originHost = url.port
      ? `${url.hostname}:${url.port}`
      : url.hostname;
    return originHost === hostHeader;
  } catch {
    return false;
  }
};

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const getHostname = (hostHeader: string | null | undefined): string | null => {
  if (!hostHeader) return null;
  if (hostHeader.startsWith("[")) {
    const end = hostHeader.indexOf("]");
    return end === -1 ? null : hostHeader.slice(1, end);
  }
  return hostHeader.split(":")[0] ?? null;
};

export type AppEnv = RequestLoggerEnv;

export const createApp = (): Hono<AppEnv> => {
  const app = new Hono<AppEnv>();

  app.use("*", requestLogger);

  app.use("*", async (c, next) => {
    const hostname = getHostname(c.req.header("host"));
    if (!hostname || !ALLOWED_HOSTS.has(hostname)) {
      return errorResponse(c, "Forbidden", ErrorCode.FORBIDDEN, 403);
    }

    return next();
  });

  app.use("*", async (c, next) => {
    c.res.headers.set("X-Frame-Options", "DENY");
    c.res.headers.set("X-Content-Type-Options", "nosniff");
    c.res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), midi=(), display-capture=()");
    c.res.headers.set("Referrer-Policy", "no-referrer");
    await next();
  });

  app.use("/api/*", async (c, next) => {
    const origin = c.req.header("origin");
    if (origin && !isLocalhostOrigin(origin) && UNSAFE_METHODS.has(c.req.method)) {
      return errorResponse(c, "Forbidden", ErrorCode.FORBIDDEN, 403);
    }
    return next();
  });

  app.use("/api/*", async (c, next) => {
    if (c.req.method === "OPTIONS") {
      return next();
    }
    const pathname = new URL(c.req.url).pathname;
    if (pathname === "/api/health") {
      return next();
    }
    const token = process.env.DIFFGAZER_SHUTDOWN_TOKEN?.trim();
    // Split dev may run without a shared token. Packaged runs fail closed, and
    // any explicitly configured token is enforced in every mode.
    const shouldRequireToken = isPackaged() || Boolean(token);
    const requestHasValidToken = token
      ? safeTokenMatch(c.req.header(SHUTDOWN_TOKEN_HEADER), token)
      : false;

    if (shouldRequireToken && !requestHasValidToken) {
      return errorResponse(c, "Unauthorized", ErrorCode.UNAUTHORIZED, 401);
    }
    return next();
  });

  app.use(
    "/api/*",
    cors({
      origin: (origin: string, c: Context) => {
        if (!origin) return origin;
        if (isPackaged()) {
          return isSameOrigin(origin, c.req.header("host")) ? origin : "";
        }
        return isLocalhostOrigin(origin) ? origin : "";
      },
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "x-diffgazer-project-root", SHUTDOWN_TOKEN_HEADER],
    })
  );

  // Health at root for container/load-balancer probes, and under /api for API client consistency
  app.route("/", healthRouter);
  app.route("/api", healthRouter);
  app.route("/api/config", configRouter);
  app.route("/api/settings", settingsRouter);
  app.route("/api/git", gitRouter);
  app.route("/api/review", reviewRouter);
  app.route("/api/shutdown", shutdownRouter);

  app.notFound((c) => {
    return errorResponse(c, "Not Found", ErrorCode.NOT_FOUND, 404);
  });

  // Domain failures use the Result<T, AppError> pattern and are mapped to status
  // codes via errorResponse/handleStoreError/drilldownErrorStatus at the route
  // layer, so no coded AppError ever reaches this global handler. Anything that
  // does throw is an unexpected bug, so this only logs and returns a generic 500;
  // branching on AppError.code here would be dead code.
  app.onError((err, c) => {
    const startTime = c.get("startTime");
    const requestId = c.get("requestId");
    log("error", "unhandled_error", {
      requestId,
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: 500,
      durationMs: startTime ? Math.round((performance.now() - startTime) * 1000) / 1000 : undefined,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    // A thrown error skips the request-logger tail, so set the id header here too.
    const response = errorResponse(c, "Internal Server Error", ErrorCode.INTERNAL_ERROR, 500);
    if (requestId) response.headers.set(REQUEST_ID_HEADER, requestId);
    return response;
  });

  return app;
};
