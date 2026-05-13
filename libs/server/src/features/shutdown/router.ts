import { Hono } from "hono";
import { SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api";
import { requestShutdown } from "./service.js";

const shutdownRouter = new Hono();

shutdownRouter.post("/", (c): Response => {
  const expectedToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN?.trim();
  if (!expectedToken || c.req.header(SHUTDOWN_TOKEN_HEADER) !== expectedToken) {
    return c.json(
      {
        ok: false,
        message: "Shutdown is not authorized.",
      },
      403,
    );
  }

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
