import { Hono } from "hono";
import { cors } from "hono/cors";

// Factory function - can be imported and bundled
// NO SIDE EFFECTS - this file only exports, never runs anything
export function createApp() {
  const app = new Hono();

  // CORS for local development
  app.use(
    "/api/*",
    cors({
      origin: ["http://localhost:3001", "http://localhost:5173"],
    })
  );

  // Health endpoint
  app.get("/api/health", (c) => {
    return c.json({
      status: "ok",
      timestamp: new Date().toISOString(),
    });
  });

  return app;
}
