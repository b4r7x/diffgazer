import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { Context } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { ErrorCode } from "@stargazer/schemas/errors";
import { AIProviderSchema } from "@stargazer/schemas/config";
import {
  activateProvider,
  checkConfig,
  deleteConfig,
  deleteProvider,
  getConfig,
  getInitState,
  getProvidersStatus,
  saveConfig,
} from "./service.js";
import { errorResponse } from "../../shared/lib/http/response.js";
import { getProjectRoot } from "../../shared/lib/http/request.js";

const configRouter = new Hono();

const saveConfigSchema = z.object({
  provider: AIProviderSchema,
  apiKey: z.string().min(1),
  model: z.string().min(1).optional(),
});

const providerParamSchema = z.object({
  providerId: AIProviderSchema,
});

const activateProviderBodySchema = z.object({
  model: z.string().min(1).optional(),
});

const invalidBodyResponse = (c: Context): Response =>
  errorResponse(c, "Invalid request body", "INVALID_BODY", 400);

const bodyLimitMiddleware = bodyLimit({
  maxSize: 50 * 1024,
  onError: (c) =>
    errorResponse(c, "Request body too large", "PAYLOAD_TOO_LARGE", 413),
});

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

configRouter.post(
  "/",
  bodyLimitMiddleware,
  zValidator("json", saveConfigSchema, (result, c) => {
    if (!result.success) return invalidBodyResponse(c);
    return;
  }),
  (c): Response => {
    const body = c.req.valid("json");
    const result = saveConfig(body);
    if (!result.ok) {
      return errorResponse(c, result.error.message, result.error.code, 400);
    }
    return c.json({ saved: true });
  },
);

configRouter.post(
  "/provider/:providerId/activate",
  bodyLimitMiddleware,
  zValidator("param", providerParamSchema),
  zValidator("json", activateProviderBodySchema, (result, c) => {
    if (!result.success) return invalidBodyResponse(c);
    return;
  }),
  (c): Response => {
    const { providerId } = c.req.valid("param");
    const { model } = c.req.valid("json");
    const activated = activateProvider({ provider: providerId, model });
    if (!activated) {
      return errorResponse(c, "Provider not found", "PROVIDER_NOT_FOUND", 404);
    }

    return c.json(activated);
  },
);

configRouter.delete(
  "/provider/:providerId",
  zValidator("param", providerParamSchema),
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

export { configRouter };
