import { type Result, ok, err } from "@diffgazer/core/result";
import { createError } from "@diffgazer/core/errors";
import type { AIProvider, CredentialRef, SetupField, SetupStatus } from "@diffgazer/core/schemas/config";
import { ALLOWED_CREDENTIAL_ENV_VARS, UserConfigSchema } from "@diffgazer/core/schemas/config";
import { ErrorCode } from "@diffgazer/core/schemas/errors";
import type { SecretsStorageError } from "../../shared/lib/config/types.js";
import type { AppError } from "@diffgazer/core/errors";
import type {
  ActivateProviderResponse,
  ConfigCheckResponse,
  CurrentConfigResponse as ConfigResponse,
  DeleteConfigResponse,
  DeleteProviderCredentialsResponse as DeleteProviderResponse,
  InitResponse,
  OpenRouterModelsResponse,
  ProviderStatus,
  ProvidersStatusResponse,
  SaveConfigRequest,
} from "@diffgazer/core/schemas/config";
import { getStore } from "../../shared/lib/config/store.js";
import { getOpenRouterModelsWithCache } from "../../shared/lib/ai/openrouter-models.js";

export const getProvidersStatus = (): ProvidersStatusResponse => {
  const providers = getStore().getProviders();
  const activeProvider = providers.find((provider) => provider.isActive)?.provider;

  return {
    providers,
    activeProvider,
  };
};

function isKeyReadable(provider: { provider: string } | null): boolean {
  if (!provider) return false;
  const keyResult = getStore().getProviderApiKey(provider.provider);
  return keyResult.ok && keyResult.value !== null;
}

export const getSetupStatus = (projectRoot?: string): SetupStatus => {
  const settings = getStore().getSettings();
  const providers = getStore().getProviders();
  const activeProvider = providers.find((p) => p.isActive) ?? null;
  const project = getStore().getProjectInfo(projectRoot);

  const hasSecretsStorage = settings.secretsStorage !== null;
  const hasProvider = activeProvider !== null && isKeyReadable(activeProvider);
  const hasModel = Boolean(activeProvider?.model);
  const hasTrust = Boolean(project.trust?.capabilities.readFiles);

  const missing: SetupField[] = [];
  if (!hasSecretsStorage) missing.push("secretsStorage");
  if (!hasProvider) missing.push("provider");
  if (!hasModel) missing.push("model");
  if (!hasTrust) missing.push("trust");

  const isConfigured = hasSecretsStorage && hasProvider && hasModel;

  return {
    hasSecretsStorage,
    hasProvider,
    hasModel,
    hasTrust,
    isConfigured,
    isReady: isConfigured && hasTrust,
    missing,
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
  // kind: "env"
  if (!ALLOWED_CREDENTIAL_ENV_VARS.has(apiKey.varName)) {
    const allowed = [...ALLOWED_CREDENTIAL_ENV_VARS].join(", ");
    return err(
      createError(
        ErrorCode.CREDENTIAL_INVALID,
        `Environment variable "${apiKey.varName}" is not an allowed provider key. Allowed: ${allowed}`,
      ),
    );
  }
  return ok(undefined);
}

export const saveConfig = (
  input: SaveConfigRequest
): Promise<Result<ProviderStatus, SecretsStorageError | { message: string; code: string }>> => {
  const validation = validateCredential(input.apiKey);
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

  // Block activation if the provider has no API key configured
  const apiKeyResult = getStore().getProviderApiKey(provider);
  if (apiKeyResult.ok && !apiKeyResult.value) {
    return err(createError("INVALID_BODY", "API key required before selecting model"));
  }

  // Validate the model against provider-level constraints
  const effectiveModel = model ?? existing.model;
  if (effectiveModel) {
    const now = new Date().toISOString();
    const validation = UserConfigSchema.safeParse({
      provider,
      model: effectiveModel,
      createdAt: now,
      updatedAt: now,
    });
    if (!validation.success) {
      return err(createError("INVALID_BODY", "Model is not valid for the selected provider"));
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
