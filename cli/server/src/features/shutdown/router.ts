import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { Hono } from "hono";
import { errorResponse } from "../../shared/lib/http/response.js";
import { requestShutdown } from "./service.js";

const shutdownRouter = new Hono();

// Token validation runs in the global /api/* middleware (see app.ts); this
// handler only reaches here for authorized requests.
shutdownRouter.post("/", (c): Response => {
  const result = requestShutdown();
  if (!result.ok) {
    return errorResponse(c, result.message, ErrorCode.SERVICE_UNAVAILABLE, 503);
  }

  return c.json({ ok: true });
});

export { shutdownRouter };
