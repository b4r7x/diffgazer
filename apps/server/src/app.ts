import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { routes } from "./api/routes/index.js";
import { errorResponse } from "./lib/response.js";

export function createServer(): Hono {
  const app = new Hono();

  app.use(logger());

  // WHY: Host header validation prevents DNS rebinding attacks (CVE-2024-28224).
  // In the Ollama vulnerability, attackers registered domains pointing to 127.0.0.1
  // and used browser JavaScript to access localhost services.
  // See: docs/decisions/0003-security-cors.md
  app.use("*", async (c, next): Promise<void | Response> => {
    const host = c.req.header("host")?.split(":")[0];
    if (host && !["localhost", "127.0.0.1"].includes(host)) {
      return c.text("Forbidden", 403);
    }
    await next();
  });

  // WHY: CSRF protection prevents cross-site request forgery on state-changing endpoints.
  // Even localhost services can be targeted by malicious websites.
  // See: docs/SECURITY.md
  app.use(csrf());

  // WHY: CORS restriction is a critical defense against DNS rebinding (CVE-2024-28224).
  // Without this, malicious websites can register domains pointing to 127.0.0.1
  // and use browser JavaScript to exfiltrate data from localhost services.
  // Combined with Host header validation, this provides defense-in-depth.
  // See: docs/decisions/0003-security-cors.md
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

  // WHY: Security headers provide defense-in-depth against browser-based attacks.
  // X-Frame-Options: DENY prevents clickjacking via iframe embedding.
  // X-Content-Type-Options: nosniff prevents MIME type confusion attacks.
  // These add minimal overhead but prevent entire attack classes.
  // See: docs/SECURITY.md
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
