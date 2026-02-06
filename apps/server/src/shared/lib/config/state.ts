import { randomUUID } from "node:crypto";
import {
  getGlobalConfigPath,
  getGlobalSecretsPath,
  getGlobalTrustPath,
  getProjectInfoPath,
} from "../paths.js";
import { readJsonFileSync, writeJsonFileSync, removeFileSync } from "../fs.js";
import { AI_PROVIDERS, type AIProvider, type ProviderStatus, type SettingsConfig, type SecretsStorage, type TrustCapabilities } from "@stargazer/schemas/config";
import type {
  ConfigState,
  ProjectFile,
  SecretsState,
  TrustState,
} from "./types.js";

const isValidAIProvider = (value: string): value is AIProvider => {
  return AI_PROVIDERS.includes(value as AIProvider);
};

export const DEFAULT_SETTINGS: SettingsConfig = {
  theme: "auto",
  secretsStorage: null,
  defaultLenses: ["correctness", "security", "performance", "simplicity", "tests"],
  defaultProfile: null,
  severityThreshold: "low",
};

export const DEFAULT_PROVIDERS: ProviderStatus[] = AI_PROVIDERS.map((id) => ({
  provider: id,
  hasApiKey: false,
  isActive: false,
}));

const CONFIG_PATH = getGlobalConfigPath();
const SECRETS_PATH = getGlobalSecretsPath();
const TRUST_PATH = getGlobalTrustPath();

const normalizeProviders = (providers: ProviderStatus[]): ProviderStatus[] => {
  const valid = providers.filter((provider) => isValidAIProvider(provider.provider));
  const byId = new Map(valid.map((provider) => [provider.provider, provider]));

  return DEFAULT_PROVIDERS.map((provider) => ({
    ...provider,
    ...byId.get(provider.provider),
  }));
};

export const loadConfig = (): ConfigState => {
  const stored = readJsonFileSync<ConfigState>(CONFIG_PATH);
  const settings = { ...DEFAULT_SETTINGS, ...(stored?.settings ?? {}) };
  const providers = normalizeProviders(stored?.providers ?? DEFAULT_PROVIDERS);

  return {
    settings: { ...settings },
    providers: providers.map((p) => ({ ...p })),
  };
};

export const loadSecrets = (): SecretsState => {
  const stored = readJsonFileSync<SecretsState>(SECRETS_PATH);
  if (!stored?.providers) {
    return { providers: {} };
  }

  return { providers: { ...stored.providers } };
};

const normalizeTrustCapabilities = (
  capabilities: TrustCapabilities | null | undefined,
): TrustCapabilities => {
  if (!capabilities) {
    return { readFiles: false, runCommands: false };
  }

  return {
    readFiles: Boolean(capabilities.readFiles),
    runCommands: Boolean(capabilities.runCommands),
  };
};

export const loadTrust = (): TrustState => {
  const stored = readJsonFileSync<TrustState>(TRUST_PATH);
  if (!stored?.projects) {
    return { projects: {} };
  }

  const normalized = Object.fromEntries(
    Object.entries(stored.projects).map(([projectId, config]) => [
      projectId,
      {
        ...config,
        capabilities: normalizeTrustCapabilities(config.capabilities),
      },
    ])
  );

  return { projects: normalized };
};

export const persistConfig = (state: ConfigState): void => {
  writeJsonFileSync(CONFIG_PATH, state, 0o600);
};

export const persistSecrets = (state: SecretsState): void => {
  writeJsonFileSync(SECRETS_PATH, state, 0o600);
};

export const persistTrust = (state: TrustState): void => {
  writeJsonFileSync(TRUST_PATH, state, 0o600);
};

export const removeSecretsFile = (): boolean => removeFileSync(SECRETS_PATH);

export const syncProvidersWithSecrets = (
  providers: ProviderStatus[],
  secrets: SecretsState,
  storage: SecretsStorage,
): ProviderStatus[] => {
  if (storage !== "file") {
    return providers.map((p) => ({ ...p }));
  }

  const providerIds = new Set(providers.map((provider) => provider.provider));
  const nextProviders = providers.map((provider) => ({
    ...provider,
    hasApiKey: secrets.providers[provider.provider] !== undefined,
  }));

  for (const providerId of Object.keys(secrets.providers)) {
    // Type guard: only add if it's a valid AIProvider
    if (!isValidAIProvider(providerId)) continue;
    if (providerIds.has(providerId)) continue;

    nextProviders.push({
      provider: providerId,
      hasApiKey: true,
      isActive: false,
    });
  }

  return nextProviders;
};

export const readOrCreateProjectFile = (projectRoot: string): ProjectFile => {
  const projectInfoPath = getProjectInfoPath(projectRoot);
  const stored = readJsonFileSync<ProjectFile>(projectInfoPath);
  if (stored?.projectId) {
    return stored;
  }

  const created: ProjectFile = {
    projectId: randomUUID(),
    repoRoot: projectRoot,
    createdAt: new Date().toISOString(),
  };

  writeJsonFileSync(projectInfoPath, created, 0o600);
  return created;
};
