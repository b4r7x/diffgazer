import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { SecretsStorageError } from "../../shared/lib/config/types.js";
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
import { requireRepoAccess } from "../../shared/middlewares/trust-guard.js";
import { ClientConfigurationActionSchema } from "./schemas.js";
import {
  type ConfigurationServiceError,
  getInitState,
  listConfigurations,
  runConfigurationAction,
} from "./service.js";

const configRouter = new Hono();

const bodyLimitMiddleware = createBodyLimitMiddleware(DEFAULT_BODY_LIMIT_KB);

const CONFIGURATION_ACTION_ERROR_CODES = new Set<ConfigurationServiceError["code"]>([
  "CONFIGURATION_NOT_FOUND",
  "CONFIGURATION_UNSUPPORTED",
  "CONFIGURATION_CONFLICT",
  "SECRET_BINDING_FAILED",
  "INVALID_ACTION",
]);

// Everything outside the action vocabulary is a secrets-storage failure, so the
// remaining codes are exactly `SecretsStorageError`'s.
const isSecretsStorageError = (error: ConfigurationServiceError): error is SecretsStorageError =>
  !CONFIGURATION_ACTION_ERROR_CODES.has(error.code);

const configurationActionErrorStatus = (code: ConfigurationServiceError["code"]): ErrorStatus => {
  switch (code) {
    case "INVALID_ACTION":
    case "CONFIGURATION_UNSUPPORTED":
      return 400;
    case "CONFIGURATION_NOT_FOUND":
      return 404;
    case "CONFIGURATION_CONFLICT":
      return 409;
    case "SECRET_BINDING_FAILED":
    case "KEYRING_UNAVAILABLE":
    case "KEYRING_READ_FAILED":
    case "KEYRING_WRITE_FAILED":
    case "KEYRING_DELETE_FAILED":
    case "SECRETS_MIGRATION_FAILED":
    case "PERSIST_FAILED":
    case "ROLLBACK_FAILED":
      return 500;
    case "SECRET_NOT_FOUND":
    case "STORAGE_NOT_CONFIGURED":
      return 400;
    case "CONCURRENCY_CONFLICT":
      return 409;
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
  if (isSecretsStorageError(error)) {
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
