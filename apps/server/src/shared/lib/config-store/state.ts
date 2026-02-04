import { randomUUID } from "node:crypto";
import {
  readJsonFileSync,
  removeFileSync,
  writeJsonFileSync,
} from "../json-storage.js";
import {
  getGlobalConfigPath,
  getGlobalSecretsPath,
  getGlobalTrustPath,
  getProjectInfoPath,
} from "../paths.js";
import { AI_PROVIDERS, type AIProvider } from "@repo/schemas/config";

const isValidAIProvider = (value: string): value is AIProvider => {
  return AI_PROVIDERS.includes(value as AIProvider);
};
import type {
  ConfigState,
  ProjectFile,
  ProviderStatus,
  SecretsState,
  SettingsConfig,
  SecretsStorage,
  TrustCapabilities,
  TrustState,
} from "./types.js";

export const DEFAULT_SETTINGS: SettingsConfig = {
  theme: "auto",
  secretsStorage: null,
};

export const DEFAULT_PROVIDERS: ProviderStatus[] = [
  { provider: "gemini", hasApiKey: false, isActive: false },
  { provider: "zai", hasApiKey: false, isActive: false },
  { provider: "zai-coding", hasApiKey: false, isActive: false },
  { provider: "openrouter", hasApiKey: false, isActive: false },
];

const CONFIG_PATH = getGlobalConfigPath();
const SECRETS_PATH = getGlobalSecretsPath();
const TRUST_PATH = getGlobalTrustPath();

const cloneProviders = (providers: ProviderStatus[]): ProviderStatus[] =>
  providers.map((provider) => ({ ...provider }));

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
  const settings = stored?.settings ?? DEFAULT_SETTINGS;
  const providers = normalizeProviders(stored?.providers ?? DEFAULT_PROVIDERS);

  return {
    settings: { ...settings },
    providers: cloneProviders(providers),
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
    return cloneProviders(providers);
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
