import { Hono } from "hono";
import { cors } from "hono/cors";
import { registerRoutes } from "./routes.js";

const ALLOWED_ORIGINS = [
  "http://localhost:3001",
  "http://127.0.0.1:3001",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

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

    await next();
  });

  app.use(
    "/api/*",
    cors({
      origin: ALLOWED_ORIGINS,
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "x-stargazer-project-root"],
    })
  );

  registerRoutes(app);

  app.notFound((c) => {
    return c.json({ error: { message: "Not Found" } }, 404);
  });

  app.onError((err, c) => {
    console.error("Unhandled error:", err);
    return c.json({ error: { message: "Internal Server Error" } }, 500);
  });

  return app;
};
