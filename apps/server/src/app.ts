import { Hono } from "hono";
import { logger } from "hono/logger";
import { routes } from "./api/routes/index.js";
import { errorResponse } from "./lib/response.js";

export function createServer(): Hono {
  const app = new Hono();

  app.use(logger());

  app.use("*", async (c, next) => {
    await next();
    c.header("X-Frame-Options", "DENY");
    c.header("X-Content-Type-Options", "nosniff");
  });

  app.route("/", routes);

  app.onError((err, c) => {
    console.error("Unhandled error:", err);
    return errorResponse(c, "Internal server error", "INTERNAL_ERROR", 500);
  });

  app.notFound((c) => {
    return errorResponse(c, "Not found", "NOT_FOUND", 404);
  });

  return app;
}
