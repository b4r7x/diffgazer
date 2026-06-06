import type { SetupField, SetupStatus } from "@diffgazer/core/schemas/config";
import { getStore } from "./store.js";

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
