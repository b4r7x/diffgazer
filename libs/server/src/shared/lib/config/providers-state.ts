import type { AIProvider, ProviderStatus, SecretsStorage } from "@diffgazer/core/schemas/config";
import type { ConfigState, SecretsState } from "./types.js";

interface ActivateUpdate {
  providerId: string;
  model?: string;
  hasApiKey?: boolean;
  preserveModel?: boolean;
}

export function applyActiveProvider(
  providers: ProviderStatus[],
  update: ActivateUpdate,
): ProviderStatus[] {
  const { providerId, model, hasApiKey, preserveModel = false } = update;
  return providers.map((item) => {
    if (item.provider !== providerId) {
      return { ...item, isActive: false };
    }

    const nextModel = preserveModel && model === undefined ? item.model : model;
    return {
      ...item,
      hasApiKey: hasApiKey ?? item.hasApiKey,
      isActive: true,
      model: nextModel,
    };
  });
}

export function ensureProviderEntry(
  providers: ProviderStatus[],
  providerId: AIProvider,
  hasApiKey: boolean,
): { providers: ProviderStatus[]; entry: ProviderStatus } {
  const existing = providers.find((provider) => provider.provider === providerId);
  if (existing) {
    return { providers, entry: existing };
  }

  const created: ProviderStatus = {
    provider: providerId,
    hasApiKey,
    isActive: false,
  };

  return { providers: [...providers, created], entry: created };
}

export function applyCredentialsWithoutModel(
  providers: ProviderStatus[],
  providerId: AIProvider,
): ProviderStatus[] {
  return providers.map((item) => {
    if (item.provider !== providerId) return item;
    const hasModel = Boolean(item.model);
    return {
      ...item,
      hasApiKey: true,
      isActive: hasModel ? item.isActive : false,
    };
  });
}

export function clearProviderCredentials(
  providers: ProviderStatus[],
  providerId: AIProvider,
): ProviderStatus[] {
  return providers.map((item) => {
    if (item.provider !== providerId) {
      return item;
    }

    return {
      ...item,
      hasApiKey: false,
      isActive: false,
      model: undefined,
    };
  });
}

export function activeProvider(
  state: ConfigState,
): ProviderStatus | null {
  const active = state.providers.find((provider) => provider.isActive);
  return active ? { ...active } : null;
}

export function isFileStorage(state: ConfigState): boolean {
  return (state.settings.secretsStorage ?? "file") === "file";
}

export function fileHasSecret(
  secretsState: SecretsState,
  providerId: string,
): boolean {
  return providerId in secretsState.providers;
}

export function effectiveStorage(state: ConfigState): SecretsStorage {
  return state.settings.secretsStorage ?? "file";
}
