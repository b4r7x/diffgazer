import { Hono } from "hono";
import { requestShutdown } from "./service.js";

const shutdownRouter = new Hono();

shutdownRouter.post("/", (c): Response => {
  const result = requestShutdown();
  if (!result.ok) {
    return c.json(
      {
        ok: false,
        message: result.message,
      },
      503
    );
  }

  return c.json({ ok: true });
});

export { shutdownRouter };
