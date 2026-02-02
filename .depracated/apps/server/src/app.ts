import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Hono } from "hono";
import { logger } from "hono/logger";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { serveStatic } from "@hono/node-server/serve-static";
import { ErrorCode } from "@repo/schemas/errors";
import { routes } from "./api/routes/index.js";
import { errorResponse } from "./lib/response.js";
import { projectContextMiddleware, type ProjectEnv } from "./context/project.js";
import { isValidProjectPath } from "./lib/validation.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webDistPath = join(__dirname, "..", "web-dist");

const ALLOWED_HOSTS = ["localhost", "127.0.0.1"];

function isLocalhost(hostname: string): boolean {
  return ALLOWED_HOSTS.includes(hostname);
}

export function createServer(projectPath?: string): Hono<ProjectEnv> {
  if (projectPath && !isValidProjectPath(projectPath)) {
    throw new Error("Invalid project path: contains path traversal or null bytes");
  }

  const app = new Hono<ProjectEnv>();

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

  if (projectPath) {
    app.use("*", projectContextMiddleware(projectPath));
  }

  app.use("/assets/*", serveStatic({ root: webDistPath }));
  app.get("/", serveStatic({ root: webDistPath, path: "/index.html" }));
  app.get("/index.html", serveStatic({ root: webDistPath, path: "/index.html" }));

  app.use("*", async (c, next) => {
    await next();
    c.header("X-Frame-Options", "DENY");
    c.header("X-Content-Type-Options", "nosniff");
  });

  app.route("/", routes);

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      const message = err.message || "Validation error";
      return errorResponse(c, message, ErrorCode.VALIDATION_ERROR, err.status);
    }
    console.error("Unhandled error:", err);
    return errorResponse(c, "Internal server error", ErrorCode.INTERNAL_ERROR, 500);
  });

  app.notFound((c) => errorResponse(c, "Not found", ErrorCode.NOT_FOUND, 404));

  return app;
}
