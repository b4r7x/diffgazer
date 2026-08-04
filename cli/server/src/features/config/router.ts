import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type {
  ConfigurationActionErrorCode,
  ConfigurationActionOnlyErrorCode,
} from "../../shared/lib/config/types.js";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import {
  type ErrorStatus,
  errorResponse,
  zodErrorHandler,
} from "../../shared/lib/http/response.js";
import { handleStoreError } from "../../shared/lib/http/store-error.js";
import {
  createBodyLimitMiddleware,
  DEFAULT_BODY_LIMIT_KB,
} from "../../shared/middlewares/body-limit.js";
import { createRateLimitMiddleware } from "../../shared/middlewares/rate-limit.js";
import { requireRepoAccess } from "../../shared/middlewares/trust-guard.js";
import { ClientConfigurationActionSchema, ConfigurationModelsParamSchema } from "./schemas.js";
import {
  type ConfigurationServiceError,
  discoverConfigurationModels,
  getInitState,
  listConfigurations,
  runConfigurationAction,
} from "./service.js";

const configRouter = new Hono();

const bodyLimitMiddleware = createBodyLimitMiddleware(DEFAULT_BODY_LIMIT_KB);
const catalogModelFetchLimit = createRateLimitMiddleware("config:catalog-models", {
  maxRequests: 30,
  windowMs: 60_000,
});

const CONFIGURATION_ACTION_ERROR_CODES = new Set<string>([
  "CONFIGURATION_NOT_FOUND",
  "CONFIGURATION_UNSUPPORTED",
  "CONFIGURATION_CONFLICT",
  "SECRET_BINDING_FAILED",
  "INVALID_ACTION",
] satisfies ConfigurationActionOnlyErrorCode[]);

const isConfigurationActionErrorCode = (
  code: ConfigurationActionErrorCode,
): code is ConfigurationActionOnlyErrorCode => CONFIGURATION_ACTION_ERROR_CODES.has(code);

const configurationActionErrorStatus = (code: ConfigurationActionOnlyErrorCode): ErrorStatus => {
  switch (code) {
    case "INVALID_ACTION":
    case "CONFIGURATION_UNSUPPORTED":
      return 400;
    case "CONFIGURATION_NOT_FOUND":
      return 404;
    case "CONFIGURATION_CONFLICT":
      return 409;
    case "SECRET_BINDING_FAILED":
      return 500;
    default: {
      const unhandled: never = code;
      throw new Error(`Unhandled configuration error code: ${unhandled}`);
    }
  }
};

function handleConfigServiceError(
  ctx: Parameters<typeof errorResponse>[0],
  error: ConfigurationServiceError,
): Response {
  // Everything outside the action vocabulary is a secrets-storage failure, and
  // those share one status table with the rest of the store errors.
  if (!isConfigurationActionErrorCode(error.code)) {
    return handleStoreError(ctx, error);
  }
  return errorResponse(ctx, error.message, error.code, configurationActionErrorStatus(error.code));
}

configRouter.get("/init", async (c): Promise<Response> => {
  const projectRoot = getProjectRoot(c);
  const result = await getInitState(projectRoot);
  if (!result.ok) {
    return handleConfigServiceError(c, result.error);
  }
  return c.json(result.value);
});

configRouter.get("/providers", async (c): Promise<Response> => {
  const result = await listConfigurations();
  if (!result.ok) {
    return handleConfigServiceError(c, result.error);
  }
  return c.json(result.value);
});

configRouter.get(
  "/providers/:configurationId/models",
  catalogModelFetchLimit,
  zValidator("param", ConfigurationModelsParamSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { configurationId } = c.req.valid("param");
    const result = await discoverConfigurationModels(configurationId);
    if (!result.ok) {
      return handleConfigServiceError(c, result.error);
    }
    return c.json(result.value);
  },
);

configRouter.post(
  "/actions",
  requireRepoAccess,
  bodyLimitMiddleware,
  zValidator("json", ClientConfigurationActionSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const action = c.req.valid("json");
    const result = await runConfigurationAction(action);
    if (!result.ok) {
      return handleConfigServiceError(c, result.error);
    }
    return c.json(result.value);
  },
);

export { configRouter };
