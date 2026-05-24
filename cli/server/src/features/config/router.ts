import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import {
  activateProvider,
  checkConfig,
  deleteConfig,
  deleteProvider,
  getConfig,
  getInitState,
  getOpenRouterModels,
  getProvidersStatus,
  saveConfig,
} from "./service.js";
import { errorResponse, zodErrorHandler } from "../../shared/lib/http/response.js";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import { createBodyLimitMiddleware } from "../../shared/middlewares/body-limit.js";
import { createRateLimitMiddleware } from "../../shared/middlewares/rate-limit.js";
import { requireRepoAccess } from "../../shared/middlewares/trust-guard.js";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { SaveConfigRequestSchema } from "@diffgazer/core/schemas/config";
import { ProviderParamSchema, ActivateProviderBodySchema } from "./schemas.js";

const configRouter = new Hono();

const bodyLimitMiddleware = createBodyLimitMiddleware(50);
const modelFetchLimit = createRateLimitMiddleware("config:models", { maxRequests: 30, windowMs: 60_000 });

configRouter.get("/init", (c): Response => {
  const projectRoot = getProjectRoot(c);
  const data = getInitState(projectRoot);
  return c.json(data);
});

configRouter.get("/check", (c): Response => {
  const result = checkConfig();
  if (!result.ok) {
    return errorResponse(c, result.error.message, result.error.code, 400);
  }
  return c.json(result.value);
});

configRouter.get("/", (c): Response => {
  const result = getConfig();
  if (!result.ok) {
    return errorResponse(c, result.error.message, result.error.code, 400);
  }
  if (!result.value) {
    return errorResponse(
      c,
      "Configuration not found",
      ErrorCode.CONFIG_NOT_FOUND,
      404,
    );
  }
  return c.json(result.value);
});

configRouter.get("/providers", (c): Response => {
  const data = getProvidersStatus();
  return c.json(data);
});

configRouter.get("/provider/openrouter/models", modelFetchLimit, async (c): Promise<Response> => {
  const result = await getOpenRouterModels();
  if (!result.ok) {
    const status = result.error.code === ErrorCode.API_KEY_MISSING ? 400 : 500;
    return errorResponse(c, result.error.message, result.error.code, status);
  }
  return c.json(result.value);
});

configRouter.post(
  "/",
  bodyLimitMiddleware,
  zValidator("json", SaveConfigRequestSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const body = c.req.valid("json");
    const result = await saveConfig(body);
    if (!result.ok) {
      return errorResponse(c, result.error.message, result.error.code, 400);
    }
    return c.json(result.value);
  },
);

configRouter.post(
  "/provider/:providerId/activate",
  requireRepoAccess,
  bodyLimitMiddleware,
  zValidator("param", ProviderParamSchema, zodErrorHandler),
  zValidator("json", ActivateProviderBodySchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { providerId } = c.req.valid("param");
    const { model } = c.req.valid("json");
    const result = await activateProvider({ provider: providerId, model });
    if (!result.ok) {
      const status = result.error.code === "PROVIDER_NOT_FOUND" ? 404 : 400;
      return errorResponse(c, result.error.message, result.error.code, status);
    }
    return c.json(result.value);
  },
);

configRouter.delete(
  "/provider/:providerId",
  requireRepoAccess,
  zValidator("param", ProviderParamSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { providerId } = c.req.valid("param");
    const result = await deleteProvider(providerId);
    if (!result.ok) {
      return errorResponse(c, result.error.message, result.error.code, 400);
    }
    return c.json(result.value);
  },
);

configRouter.delete("/", requireRepoAccess, async (c): Promise<Response> => {
  const result = await deleteConfig();
  if (!result.ok) {
    const status = result.error.code === ErrorCode.CONFIG_NOT_FOUND ? 404 : 400;
    return errorResponse(c, result.error.message, result.error.code, status);
  }
  return c.json(result.value);
});

export { configRouter };
