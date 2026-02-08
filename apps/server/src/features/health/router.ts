import { Hono } from "hono";

const healthRouter = new Hono();

healthRouter.get("/health", (c): Response => {
  return c.json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

export { healthRouter };
