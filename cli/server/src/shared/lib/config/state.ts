import { randomUUID } from "node:crypto";
import {
  getGlobalConfigPath,
  getGlobalSecretsPath,
  getGlobalTrustPath,
  getProjectInfoPath,
} from "../paths.js";
import { readJsonFileSync, readJsonFileSyncSafe, quarantineCorruptFile, writeJsonFileSync, writeJsonFile, removeFileSync } from "../fs.js";
import { TrustConfigSchema, AI_PROVIDERS, PROVIDER_ENV_VARS, type AIProvider, type ProviderStatus, type SettingsConfig, type SecretsStorage, type TrustCapabilities, type TrustConfig } from "@diffgazer/core/schemas/config";
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
  agentExecution: "sequential",
};

export const DEFAULT_PROVIDERS: ProviderStatus[] = AI_PROVIDERS.map((id) => ({
  provider: id,
  hasApiKey: false,
  isActive: false,
}));

let _configPath: string | undefined;
let _secretsPath: string | undefined;
let _trustPath: string | undefined;

const CONFIG_PATH = (): string => (_configPath ??= getGlobalConfigPath());
const SECRETS_PATH = (): string => (_secretsPath ??= getGlobalSecretsPath());
const TRUST_PATH = (): string => (_trustPath ??= getGlobalTrustPath());

const normalizeProviders = (providers: ProviderStatus[]): ProviderStatus[] => {
  const valid = providers.filter((provider) => isValidAIProvider(provider.provider));
  const byId = new Map(valid.map((provider) => [provider.provider, provider]));

  return DEFAULT_PROVIDERS.map((provider) => ({
    ...provider,
    ...byId.get(provider.provider),
  }));
};

const loadOrQuarantine = <T>(filePath: string, label: string): T | null => {
  const result = readJsonFileSyncSafe<T>(filePath);
  if (result.status === "ok") return result.data;
  if (result.status === "missing") return null;
  const backupPath = quarantineCorruptFile(filePath);
  console.warn(`[config] Corrupt ${label} at ${filePath} — quarantined as ${backupPath}. Loading defaults.`);
  return null;
};

export const loadConfig = (): ConfigState => {
  const stored = loadOrQuarantine<ConfigState>(CONFIG_PATH(), "config");
  const settings = { ...DEFAULT_SETTINGS, ...(stored?.settings ?? {}) };
  const providers = normalizeProviders(stored?.providers ?? DEFAULT_PROVIDERS);

  return {
    settings: { ...settings },
    providers: providers.map((p) => ({ ...p })),
  };
};

export const loadSecrets = (): SecretsState => {
  const stored = loadOrQuarantine<SecretsState>(SECRETS_PATH(), "secrets");
  if (!stored?.providers) {
    return { providers: {} };
  }

  // Migrate legacy "env" sentinel strings to structured env refs
  const migrated: SecretsState["providers"] = {};
  for (const [key, value] of Object.entries(stored.providers)) {
    if (value === "env") {
      const isProvider = isValidAIProvider(key);
      const varName = isProvider ? PROVIDER_ENV_VARS[key] : key.toUpperCase();
      migrated[key] = { kind: "env", varName };
    } else {
      migrated[key] = value;
    }
  }

  return { providers: migrated };
};

const validateTrustRecord = (projectId: string, raw: unknown): TrustConfig | null => {
  const result = TrustConfigSchema.safeParse(raw);
  if (result.success) return result.data;
  console.warn(`[config] Dropping invalid trust record for ${projectId}: ${result.error.message}`);
  return null;
};

export const loadTrust = (): TrustState => {
  const stored = loadOrQuarantine<TrustState>(TRUST_PATH(), "trust");
  if (!stored?.projects) {
    return { projects: {} };
  }

  const validated: Record<string, TrustConfig> = {};
  for (const [projectId, config] of Object.entries(stored.projects)) {
    const record = validateTrustRecord(projectId, config);
    if (record) validated[projectId] = record;
  }

  return { projects: validated };
};

export const persistConfig = (state: ConfigState): void => {
  writeJsonFileSync(CONFIG_PATH(), state, 0o600);
};

export const persistConfigAsync = (state: ConfigState): Promise<void> =>
  writeJsonFile(CONFIG_PATH(), state, 0o600);

export const persistSecrets = (state: SecretsState): void => {
  writeJsonFileSync(SECRETS_PATH(), state, 0o600);
};

export const persistSecretsAsync = (state: SecretsState): Promise<void> =>
  writeJsonFile(SECRETS_PATH(), state, 0o600);

export const persistTrust = (state: TrustState): void => {
  writeJsonFileSync(TRUST_PATH(), state, 0o600);
};

export const persistTrustAsync = (state: TrustState): Promise<void> =>
  writeJsonFile(TRUST_PATH(), state, 0o600);

export const removeSecretsFile = (): boolean => removeFileSync(SECRETS_PATH());

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

export const readProjectFile = (projectRoot: string): ProjectFile | null => {
  const projectInfoPath = getProjectInfoPath(projectRoot);
  const stored = readJsonFileSync<ProjectFile>(projectInfoPath);
  if (stored?.projectId) return stored;
  return null;
};

export const createProjectFile = (projectRoot: string): ProjectFile => {
  const existing = readProjectFile(projectRoot);
  if (existing) return existing;

  const created: ProjectFile = {
    projectId: randomUUID(),
    repoRoot: projectRoot,
    createdAt: new Date().toISOString(),
  };

  writeJsonFileSync(getProjectInfoPath(projectRoot), created, 0o600);
  return created;
};

export const readOrCreateProjectFile = createProjectFile;
