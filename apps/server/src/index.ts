import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";

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

// Start server
const port = Number(process.env.PORT) || 3000;

// Bug 3 fix: Log only after server is actually bound
serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Server running on http://localhost:${info.port}`);
  }
);

export { app };
