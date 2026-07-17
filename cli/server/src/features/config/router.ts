import { PROVIDER_DISABLED, SaveConfigRequestSchema } from "@diffgazer/core/schemas/config";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { ProviderModelsErrorCode } from "../../shared/lib/http/error-codes.js";
import { getProjectRoot } from "../../shared/lib/http/request.js";
import {
  type ErrorStatus,
  errorResponse,
  zodErrorHandler,
} from "../../shared/lib/http/response.js";
import { storeErrorStatus } from "../../shared/lib/http/store-error.js";
import { cancelSessionsForProvider } from "../../shared/lib/session-registry.js";
import {
  createBodyLimitMiddleware,
  DEFAULT_BODY_LIMIT_KB,
} from "../../shared/middlewares/body-limit.js";
import { createRateLimitMiddleware } from "../../shared/middlewares/rate-limit.js";
import { requireRepoAccess } from "../../shared/middlewares/trust-guard.js";
import {
  ActivateProviderBodySchema,
  ProviderModelsParamSchema,
  ProviderParamSchema,
} from "./schemas.js";
import {
  activateProvider,
  checkConfig,
  deleteConfig,
  deleteProvider,
  getConfig,
  getInitState,
  getOpenRouterModels,
  getProviderModels,
  getProvidersStatus,
  saveConfig,
} from "./service.js";

const configRouter = new Hono();

const bodyLimitMiddleware = createBodyLimitMiddleware(DEFAULT_BODY_LIMIT_KB);
const openRouterModelFetchLimit = createRateLimitMiddleware("config:openrouter-models", {
  maxRequests: 30,
  windowMs: 60_000,
});
const catalogModelFetchLimit = createRateLimitMiddleware("config:catalog-models", {
  maxRequests: 30,
  windowMs: 60_000,
});

configRouter.get("/init", (c): Response => {
  const projectRoot = getProjectRoot(c);
  const result = getInitState(projectRoot);
  if (!result.ok) {
    return errorResponse(
      c,
      result.error.message,
      result.error.code,
      storeErrorStatus(result.error.code),
    );
  }
  return c.json(result.value);
});

configRouter.get("/check", (c): Response => {
  const result = checkConfig();
  if (!result.ok) {
    return errorResponse(
      c,
      result.error.message,
      result.error.code,
      storeErrorStatus(result.error.code),
    );
  }
  return c.json(result.value);
});

configRouter.get("/", (c): Response => {
  const result = getConfig();
  if (!result.ok) {
    return errorResponse(
      c,
      result.error.message,
      result.error.code,
      storeErrorStatus(result.error.code),
    );
  }
  if (!result.value) {
    return errorResponse(c, "Configuration not found", ErrorCode.CONFIG_NOT_FOUND, 404);
  }
  return c.json(result.value);
});

configRouter.get("/providers", (c): Response => {
  const data = getProvidersStatus();
  return c.json(data);
});

configRouter.get(
  "/provider/openrouter/models",
  openRouterModelFetchLimit,
  async (c): Promise<Response> => {
    const result = await getOpenRouterModels();
    if (!result.ok) {
      return errorResponse(
        c,
        result.error.message,
        result.error.code,
        storeErrorStatus(result.error.code),
      );
    }
    return c.json(result.value);
  },
);

const PROVIDER_MODELS_ERROR_STATUS: Record<ProviderModelsErrorCode, ErrorStatus> = {
  [ErrorCode.VALIDATION_ERROR]: 400,
  [PROVIDER_DISABLED]: 404,
  [ErrorCode.API_KEY_MISSING]: 400,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
};

configRouter.get(
  "/provider/:id/models",
  catalogModelFetchLimit,
  zValidator("param", ProviderModelsParamSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const { id } = c.req.valid("param");
    const result = await getProviderModels(id);
    if (!result.ok) {
      const status = PROVIDER_MODELS_ERROR_STATUS[result.error.code] ?? 500;
      return errorResponse(c, result.error.message, result.error.code, status);
    }
    return c.json(result.value);
  },
);

configRouter.post(
  "/",
  bodyLimitMiddleware,
  zValidator("json", SaveConfigRequestSchema, zodErrorHandler),
  async (c): Promise<Response> => {
    const body = c.req.valid("json");
    const result = await saveConfig(body);
    if (!result.ok) {
      return errorResponse(
        c,
        result.error.message,
        result.error.code,
        storeErrorStatus(result.error.code),
      );
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
      return errorResponse(
        c,
        result.error.message,
        result.error.code,
        storeErrorStatus(result.error.code),
      );
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
      return errorResponse(
        c,
        result.error.message,
        result.error.code,
        storeErrorStatus(result.error.code),
      );
    }
    if (result.value.deleted) {
      cancelSessionsForProvider(providerId, {
        message: "Review session cancelled because its provider configuration was deleted.",
        reason: "provider_deleted",
      });
    }
    return c.json(result.value);
  },
);

configRouter.delete("/", requireRepoAccess, async (c): Promise<Response> => {
  const currentConfig = getConfig();
  const activeProvider = currentConfig.ok ? (currentConfig.value?.provider ?? null) : null;
  const result = await deleteConfig();
  if (!result.ok) {
    return errorResponse(
      c,
      result.error.message,
      result.error.code,
      storeErrorStatus(result.error.code),
    );
  }
  if (result.value.deleted) {
    if (activeProvider) {
      cancelSessionsForProvider(activeProvider, {
        message: "Review session cancelled because its provider configuration was deleted.",
        reason: "config_deleted",
      });
    }
  }
  return c.json(result.value);
});

export { configRouter };
