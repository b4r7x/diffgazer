import { ok, type Result } from "@diffgazer/core/result";
import type { SetupField, SetupStatus } from "@diffgazer/core/schemas/config";
import { getStore } from "./store.js";
import type { SecretsStorageError } from "./types.js";

function isKeyReadable(
  provider: { provider: string } | null,
): Result<boolean, SecretsStorageError> {
  if (!provider) return ok(false);
  const keyResult = getStore().getProviderApiKey(provider.provider);
  if (!keyResult.ok) return keyResult;
  return ok(keyResult.value !== null);
}

export const getSetupStatus = (projectRoot?: string): Result<SetupStatus, SecretsStorageError> => {
  const settings = getStore().getSettings();
  const providers = getStore().getProviders();
  const activeProvider = providers.find((p) => p.isActive) ?? null;
  const keyReadable = isKeyReadable(activeProvider);
  if (!keyReadable.ok) return keyReadable;
  const project = getStore().getProjectInfo(projectRoot);

  const hasSecretsStorage = settings.secretsStorage !== null;
  const hasProvider = activeProvider !== null && keyReadable.value;
  const hasModel = Boolean(activeProvider?.model);
  const hasTrust = Boolean(project.trust?.capabilities.readFiles);

  const missing: SetupField[] = [];
  if (!hasSecretsStorage) missing.push("secretsStorage");
  if (!hasProvider) missing.push("provider");
  if (!hasModel) missing.push("model");
  if (!hasTrust) missing.push("trust");

  const isConfigured = hasSecretsStorage && hasProvider && hasModel;

  return ok({
    hasSecretsStorage,
    hasProvider,
    hasModel,
    hasTrust,
    isConfigured,
    isReady: isConfigured && hasTrust,
    missing,
  });
};
