import { Hono } from "hono";
import { SHUTDOWN_TOKEN_HEADER } from "@diffgazer/core/api";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { safeTokenMatch } from "../../shared/lib/crypto.js";
import { errorResponse } from "../../shared/lib/http/response.js";
import { requestShutdown } from "./service.js";

const shutdownRouter = new Hono();

shutdownRouter.post("/", (c): Response => {
  const expectedToken = process.env.DIFFGAZER_SHUTDOWN_TOKEN?.trim();
  if (!expectedToken || !safeTokenMatch(c.req.header(SHUTDOWN_TOKEN_HEADER), expectedToken)) {
    return errorResponse(c, "Shutdown is not authorized.", ErrorCode.UNAUTHORIZED, 403);
  }

  const result = requestShutdown();
  if (!result.ok) {
    return errorResponse(c, result.message, ErrorCode.SERVICE_UNAVAILABLE, 503);
  }

  return c.json({ ok: true });
});

export { shutdownRouter };
