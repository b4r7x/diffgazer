import { PROVIDER_OVERLAY, type ProviderOverlay, SURFACED_OVERLAYS } from "@diffgazer/core/catalog";
import type { AppError } from "@diffgazer/core/errors";
import { createError, getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type {
  ActivateProviderResponse,
  AIProvider,
  ConfigCheckResponse,
  CurrentConfigResponse as ConfigResponse,
  CredentialRef,
  DeleteConfigResponse,
  DeleteProviderCredentialsResponse as DeleteProviderResponse,
  InitResponse,
  OpenRouterModelsResponse,
  ProviderStatus,
  ProvidersStatusResponse,
  SaveConfigRequest,
} from "@diffgazer/core/schemas/config";
import {
  type CatalogErrorCode,
  PROVIDER_DISABLED,
  PROVIDER_ENV_VARS,
  type ProviderModelsResponse,
  ProviderModelsResponseSchema,
} from "@diffgazer/core/schemas/config";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import { getProviderModels as getProviderModelsFromCatalog } from "../../shared/lib/ai/models-dev-catalog.js";
import { getOpenRouterModelsWithCache } from "../../shared/lib/ai/openrouter-models.js";
import { getSetupStatus } from "../../shared/lib/config/setup-status.js";
import { getStore } from "../../shared/lib/config/store.js";
import type { SecretsStorageError } from "../../shared/lib/config/types.js";

export { getSetupStatus };

export const getProvidersStatus = (): ProvidersStatusResponse => {
  const providers = getStore().getProviders();
  const activeProvider = providers.find((provider) => provider.isActive)?.provider;

  return {
    providers,
    activeProvider,
  };
};

export const getInitState = (projectRoot?: string): InitResponse => {
  const providers = getStore().getProviders();
  const activeProvider = providers.find((provider) => provider.isActive) ?? null;

  return {
    config: activeProvider
      ? { provider: activeProvider.provider, model: activeProvider.model }
      : null,
    settings: getStore().getSettings(),
    providers,
    configured: providers.some((provider) => provider.isActive),
    project: getStore().getProjectInfo(projectRoot),
    setup: getSetupStatus(projectRoot),
  };
};

/** Validate a credential ref or literal API key before persisting. */
function validateCredential(
  provider: AIProvider,
  apiKey: string | CredentialRef,
): Result<void, { message: string; code: string }> {
  if (typeof apiKey === "string") {
    if (apiKey.trim().length === 0) {
      return err(createError(ErrorCode.CREDENTIAL_INVALID, "API key must not be empty or whitespace-only"));
    }
    return ok(undefined);
  }
  if (apiKey.kind === "literal") {
    if (apiKey.value.trim().length === 0) {
      return err(createError(ErrorCode.CREDENTIAL_INVALID, "API key must not be empty or whitespace-only"));
    }
    return ok(undefined);
  }
  // kind: "env" — a provider may only reference its OWN env var, not another
  // provider's allowed key (no cross-provider credential binding).
  const expected = PROVIDER_ENV_VARS[provider];
  if (apiKey.varName !== expected) {
    return err(
      createError(
        ErrorCode.CREDENTIAL_INVALID,
        `Environment variable "${apiKey.varName}" is not the key for provider "${provider}". Expected: ${expected}`,
      ),
    );
  }
  return ok(undefined);
}

export const saveConfig = (
  input: SaveConfigRequest
): Promise<Result<ProviderStatus, SecretsStorageError | { message: string; code: string }>> => {
  const validation = validateCredential(input.provider, input.apiKey);
  if (!validation.ok) return Promise.resolve(validation);

  return getStore().saveProviderCredentials({
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
  });
};

export const getConfig = (): Result<ConfigResponse | null, SecretsStorageError> => {
  const active = getStore().getActiveProvider();
  if (!active) return ok(null);

  const apiKeyResult = getStore().getProviderApiKey(active.provider);
  if (!apiKeyResult.ok) return apiKeyResult;
  if (!apiKeyResult.value) return ok(null);

  return ok({ provider: active.provider, model: active.model });
};

export const checkConfig = (): Result<ConfigCheckResponse, SecretsStorageError> => {
  const configResult = getConfig();
  if (!configResult.ok) return configResult;
  if (!configResult.value) {
    return ok({ configured: false });
  }
  return ok({ configured: true, config: configResult.value });
};

export const activateProvider = async (input: {
  provider: AIProvider;
  model?: string;
}): Promise<Result<ActivateProviderResponse, { message: string; code: string }>> => {
  const { provider, model } = input;

  const existing = getStore().getProviders().find((p) => p.provider === provider);
  if (!existing) {
    return err(createError("PROVIDER_NOT_FOUND", "Provider not found"));
  }

  if (!model && !existing.model) {
    return err(createError("INVALID_BODY", "Model selection is required"));
  }

  // Block activation when the credential cannot be confirmed: a failed read fails
  // closed, and a successful read with no key means none is configured yet.
  const apiKeyResult = getStore().getProviderApiKey(provider);
  if (!apiKeyResult.ok) {
    return err(createError("INVALID_BODY", apiKeyResult.error.message));
  }
  if (!apiKeyResult.value) {
    return err(createError("INVALID_BODY", "API key required before selecting model"));
  }

  // Reject a model id absent from the provider's resolved catalog. OpenRouter is
  // exempt: its models come from the live key-gated route, not the catalog.
  const effectiveModel = model ?? existing.model;
  if (effectiveModel && provider !== "openrouter") {
    const { models } = await getProviderModelsFromCatalog(provider);
    if (!models.some((m) => m.id === effectiveModel)) {
      return err(
        createError("MODEL_ERROR", `Model "${effectiveModel}" is not available for provider "${provider}".`),
      );
    }
  }

  const result = await getStore().activateProvider(input);
  if (!result.ok) return result;
  if (!result.value) {
    return err(createError("PROVIDER_NOT_FOUND", "Provider not found"));
  }

  return ok({ provider: result.value.provider, model: result.value.model });
};

export const deleteProvider = async (
  providerId: AIProvider
): Promise<Result<DeleteProviderResponse, SecretsStorageError>> => {
  const deletedResult = await getStore().deleteProviderCredentials(providerId);
  if (!deletedResult.ok) return deletedResult;

  return ok({
    deleted: deletedResult.value,
    provider: providerId,
  });
};

export const deleteConfig = async (): Promise<Result<DeleteConfigResponse, SecretsStorageError | AppError<"CONFIG_NOT_FOUND">>> => {
  const configResult = getConfig();
  if (!configResult.ok) return configResult;
  if (!configResult.value) {
    return err(createError(ErrorCode.CONFIG_NOT_FOUND, "No active configuration to delete"));
  }

  const deletedResult = await getStore().deleteProviderCredentials(configResult.value.provider);
  if (!deletedResult.ok) return deletedResult;
  return ok({ deleted: deletedResult.value });
};

export const getOpenRouterModels = async (): Promise<
  Result<OpenRouterModelsResponse, { message: string; code: string }>
> => {
  const apiKeyResult = getStore().getProviderApiKey("openrouter");
  if (!apiKeyResult.ok) return err(apiKeyResult.error);
  if (!apiKeyResult.value) {
    return err(
      createError(
        ErrorCode.API_KEY_MISSING,
        "OpenRouter API key is required to fetch models"
      )
    );
  }

  const result = await getOpenRouterModelsWithCache(apiKeyResult.value);
  if (!result.ok) {
    return err(
      createError(
        ErrorCode.INTERNAL_ERROR,
        result.error.message
      )
    );
  }
  return ok(result.value);
};

/** Resolve a route provider id to its overlay, or null when the id is unknown. */
function resolveProviderOverlay(providerId: string): ProviderOverlay | null {
  return (PROVIDER_OVERLAY as Record<string, ProviderOverlay>)[providerId]
    ?? SURFACED_OVERLAYS[providerId]
    ?? null;
}

/**
 * Error codes getProviderModels can return, so the router can map them to HTTP
 * statuses exhaustively instead of bucketing everything into 500.
 */
export type ProviderModelsErrorCode = CatalogErrorCode | typeof ErrorCode.VALIDATION_ERROR;

export const getProviderModels = async (
  providerId: string,
): Promise<Result<ProviderModelsResponse, { message: string; code: ProviderModelsErrorCode }>> => {
  const overlay = resolveProviderOverlay(providerId);
  if (!overlay) {
    return err(createError(ErrorCode.VALIDATION_ERROR, `Unknown provider: ${providerId}`));
  }
  // D4: OpenRouter is never served from the models.dev catalog. Its models come
  // from the live key-gated /provider/openrouter/models route because the catalog
  // lacks the per-model supported_parameters the compatibility gate depends on.
  if (providerId === "openrouter" || !overlay.enabled) {
    return err(createError<CatalogErrorCode>(PROVIDER_DISABLED, `Provider '${providerId}' is not served by the catalog`));
  }
  try {
    const payload = await getProviderModelsFromCatalog(providerId as AIProvider);
    return ok(ProviderModelsResponseSchema.parse(payload));
  } catch (error) {
    return err(createError(ErrorCode.INTERNAL_ERROR, getErrorMessage(error, "Failed to load provider models")));
  }
};
