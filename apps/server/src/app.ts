import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { ErrorCode } from "@repo/schemas/errors";
import { routes } from "./api/routes/index.js";
import { errorResponse } from "./lib/response.js";

const ALLOWED_HOSTS = ["localhost", "127.0.0.1"];

function isLocalhost(hostname: string): boolean {
  return ALLOWED_HOSTS.includes(hostname);
}

export function createServer(): Hono {
  const app = new Hono();

  if (process.env.DEBUG) {
    app.use(logger());
  }

  app.use("*", async (c, next): Promise<void | Response> => {
    const host = c.req.header("host")?.split(":")[0];
    if (host && !isLocalhost(host)) {
      return c.text("Forbidden", 403);
    }
    await next();
  });

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) return origin;
        try {
          return isLocalhost(new URL(origin).hostname) ? origin : "";
        } catch {
          return "";
        }
      },
      credentials: true,
    })
  );

  app.use(csrf());

  app.use("*", async (c, next) => {
    await next();
    c.header("X-Frame-Options", "DENY");
    c.header("X-Content-Type-Options", "nosniff");
  });

  app.route("/", routes);

  app.onError((err, c) => {
    console.error("Unhandled error:", err);
    return errorResponse(c, "Internal server error", ErrorCode.INTERNAL_ERROR, 500);
  });

  app.notFound((c) => errorResponse(c, "Not found", ErrorCode.NOT_FOUND, 404));

  return app;
}
