import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { routes } from "./api/routes/index.js";
import { errorResponse } from "./lib/response.js";

export function createServer(): Hono {
  const app = new Hono();

  app.use(logger());

  // CVE-2024-28224: Host header validation prevents DNS rebinding
  app.use("*", async (c, next): Promise<void | Response> => {
    const host = c.req.header("host")?.split(":")[0];
    if (host && !["localhost", "127.0.0.1"].includes(host)) {
      return c.text("Forbidden", 403);
    }
    await next();
  });

  // CSRF protection for state-changing endpoints
  app.use(csrf());

  // CVE-2024-28224: CORS localhost restriction prevents DNS rebinding
  app.use(
    "*",
    cors({
      origin: (origin) => {
        // Allow requests with no origin (e.g., same-origin, curl, etc.)
        if (!origin) return origin;

        // Parse the origin URL
        try {
          const url = new URL(origin);
          const hostname = url.hostname;

          // Allow only localhost and 127.0.0.1
          if (hostname === "localhost" || hostname === "127.0.0.1") {
            return origin;
          }
        } catch {
          // Invalid origin URL
          return "";
        }

        // Reject all other origins
        return "";
      },
      credentials: true,
    })
  );

  // Security headers: X-Frame-Options, X-Content-Type-Options
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
