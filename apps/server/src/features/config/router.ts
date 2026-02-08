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
import { ErrorCode } from "@stargazer/schemas/errors";
import { SaveConfigSchema, ProviderParamSchema, ActivateProviderBodySchema } from "./schemas.js";

const configRouter = new Hono();

const bodyLimitMiddleware = createBodyLimitMiddleware(50);

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

configRouter.get("/provider/openrouter/models", async (c): Promise<Response> => {
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
  zValidator("json", SaveConfigSchema, zodErrorHandler),
  (c): Response => {
    const body = c.req.valid("json");
    const result = saveConfig(body);
    if (!result.ok) {
      return errorResponse(c, result.error.message, result.error.code, 400);
    }
    return c.json(result.value);
  },
);

configRouter.post(
  "/provider/:providerId/activate",
  bodyLimitMiddleware,
  zValidator("param", ProviderParamSchema),
  zValidator("json", ActivateProviderBodySchema, zodErrorHandler),
  (c): Response => {
    const { providerId } = c.req.valid("param");
    const { model } = c.req.valid("json");
    const result = activateProvider({ provider: providerId, model });
    if (!result.ok) {
      const status = result.error.code === "PROVIDER_NOT_FOUND" ? 404 : 400;
      return errorResponse(c, result.error.message, result.error.code, status);
    }
    return c.json(result.value);
  },
);

configRouter.delete(
  "/provider/:providerId",
  zValidator("param", ProviderParamSchema, zodErrorHandler),
  (c): Response => {
    const { providerId } = c.req.valid("param");
    const result = deleteProvider(providerId);
    if (!result.ok) {
      return errorResponse(c, result.error.message, result.error.code, 400);
    }
    return c.json(result.value);
  },
);

configRouter.delete("/", (c): Response => {
  const result = deleteConfig();
  if (!result.ok) {
    const status = result.error.code === ErrorCode.CONFIG_NOT_FOUND ? 404 : 400;
    return errorResponse(c, result.error.message, result.error.code, status);
  }
  return c.json(result.value);
});

export { configRouter };
