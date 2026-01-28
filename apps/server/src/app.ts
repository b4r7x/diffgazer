import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { ErrorCode } from "@repo/schemas/errors";
import { routes } from "./api/routes/index.js";
import { errorResponse } from "./lib/response.js";

export function createServer(): Hono {
  const app = new Hono();

  app.use(logger());

  app.use("*", async (c, next): Promise<void | Response> => {
    const host = c.req.header("host")?.split(":")[0];
    if (host && !["localhost", "127.0.0.1"].includes(host)) {
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
          const url = new URL(origin);
          const hostname = url.hostname;

          if (hostname === "localhost" || hostname === "127.0.0.1") {
            return origin;
          }
        } catch {
          return "";
        }

        return "";
      },
      credentials: true,
    }),
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

  app.notFound((c) => {
    return errorResponse(c, "Not found", ErrorCode.NOT_FOUND, 404);
  });

  return app;
}
