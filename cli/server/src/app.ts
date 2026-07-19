import { PROJECT_ROOT_HEADER, SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api/protocol";
import { getErrorMessage, getErrorStack } from "@diffgazer/core/errors";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { Context } from "hono";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { configRouter } from "./features/config/router.js";
import { gitRouter } from "./features/git/router.js";
import { healthRouter } from "./features/health.js";
import { reviewRouter } from "./features/review/router.js";
import { rekeyProjectReviews } from "./features/review/storage/reviews.js";
import { settingsRouter } from "./features/settings/router.js";
import { shutdownRouter } from "./features/shutdown/router.js";
import { setReviewRekeyHandler } from "./shared/lib/config/store.js";
import { safeTokenMatch } from "./shared/lib/crypto.js";
import { errorResponse, httpExceptionResponse } from "./shared/lib/http/response.js";
import { log } from "./shared/lib/log.js";
import { isPackaged } from "./shared/lib/paths.js";
import { type RequestLoggerEnv, requestLogger } from "./shared/middlewares/request-logger.js";

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
    const originHost = url.port ? `${url.hostname}:${url.port}` : url.hostname;
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

  // Wire the config store's move hook to the review-storage re-key helper so a
  // moved repo's review history follows the move (F-447). `shared/` cannot import
  // `features/`, so the composition root registers it here. Project persistence
  // commits the new root only when this migration reports complete.
  setReviewRekeyHandler(rekeyProjectReviews);

  // Split dev (not packaged, no configured token) intentionally leaves the
  // /api/* token gate open; the residual exposure is a hostile localhost origin
  // in dev only. Make that an explicit, observable decision at startup.
  if (!isPackaged() && !process.env.DIFFGAZER_SHUTDOWN_TOKEN?.trim()) {
    log("warn", "api_token_gate_disabled", {
      message: "API token gate disabled (split dev); set DIFFGAZER_SHUTDOWN_TOKEN to enable",
    });
  }

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
    c.res.headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), midi=(), display-capture=()",
    );
    c.res.headers.set("Referrer-Policy", "no-referrer");
    await next();
  });

  app.use("/api/*", async (c, next) => {
    const origin = c.req.header("origin");
    const token = process.env.DIFFGAZER_SHUTDOWN_TOKEN?.trim();
    const isTokenlessDevelopment = !isPackaged() && !token;
    if (
      origin &&
      !isLocalhostOrigin(origin) &&
      (isTokenlessDevelopment || UNSAFE_METHODS.has(c.req.method))
    ) {
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
      allowHeaders: ["Content-Type", "Authorization", PROJECT_ROOT_HEADER, SHUTDOWN_TOKEN_HEADER],
    }),
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
  // codes via errorResponse/handleStoreError at the route layer, so no coded
  // AppError ever reaches this global handler. Anything that
  // does throw is an unexpected bug, so this only logs and returns a generic 500;
  // branching on AppError.code here would be dead code.
  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      const response = httpExceptionResponse(c, err);
      if (response) return response;
    }

    // The requestLogger tail still runs (onError resolves the middleware chain),
    // so it logs the completed request and re-sets the id header. Log only the
    // crash diagnostic the tail cannot provide.
    log("error", "unhandled_error", {
      requestId: c.get("requestId"),
      error: getErrorMessage(err),
      stack: getErrorStack(err),
    });
    return errorResponse(c, "Internal Server Error", ErrorCode.INTERNAL_ERROR, 500);
  });

  return app;
};
