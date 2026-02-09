import { Hono } from "hono";
import { cors } from "hono/cors";
import { healthRouter } from "./features/health/router.js";
import { configRouter } from "./features/config/router.js";
import { settingsRouter } from "./features/settings/router.js";
import { gitRouter } from "./features/git/router.js";
import { reviewRouter } from "./features/review/router.js";
import { shutdownRouter } from "./features/shutdown/router.js";

const isLocalhostOrigin = (origin: string): boolean => {
  try {
    const url = new URL(origin);
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
};

const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const getHostname = (hostHeader: string | null | undefined): string | null => {
  if (!hostHeader) return null;
  if (hostHeader.startsWith("[")) {
    const end = hostHeader.indexOf("]");
    return end === -1 ? null : hostHeader.slice(1, end);
  }
  return hostHeader.split(":")[0] ?? null;
};

export const createApp = (): Hono => {
  const app = new Hono();

  app.use("*", async (c, next) => {
    const hostname = getHostname(c.req.header("host"));
    if (!hostname || !ALLOWED_HOSTS.has(hostname)) {
      return c.json({ error: { message: "Forbidden" } }, 403);
    }

    return next();
  });

  app.use("*", async (c, next) => {
    c.res.headers.set("X-Frame-Options", "DENY");
    c.res.headers.set("X-Content-Type-Options", "nosniff");
    await next();
  });

  app.use(
    "/api/*",
    cors({
      origin: (origin) => {
        if (!origin) return origin;
        return isLocalhostOrigin(origin) ? origin : "";
      },
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "x-stargazer-project-root"],
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
    return c.json({ error: { message: "Not Found" } }, 404);
  });

  app.onError((err, c) => {
    console.error("Unhandled error:", err);
    return c.json({ error: { message: "Internal Server Error" } }, 500);
  });

  return app;
};
