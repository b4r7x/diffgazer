import { randomUUID } from "node:crypto";
import {
  readJsonFileSync,
  removeFileSync,
  writeJsonFileSync,
} from "./json-storage.js";
import {
  getGlobalConfigPath,
  getGlobalSecretsPath,
  getGlobalTrustPath,
  getProjectInfoPath,
  resolveProjectRoot,
} from "./stargazer-paths.js";

export type Theme = "auto" | "dark" | "light" | "terminal";
export type SecretsStorage = "file" | "keyring";

export interface SettingsConfig {
  theme: Theme;
  defaultLenses?: string[];
  defaultProfile?: string | null;
  severityThreshold?: string;
  secretsStorage?: SecretsStorage | null;
}

export interface ProviderStatus {
  provider: string;
  hasApiKey: boolean;
  isActive: boolean;
  model?: string;
  mode?: string;
}

export interface TrustCapabilities {
  readFiles: boolean;
  readGit: boolean;
  runCommands: boolean;
}

export type TrustMode = "persistent" | "session";

export interface TrustConfig {
  projectId: string;
  repoRoot: string;
  trustedAt: string;
  capabilities: TrustCapabilities;
  trustMode: TrustMode;
}

export interface ProjectInfo {
  path: string;
  projectId: string;
  trust: TrustConfig | null;
}

interface ConfigState {
  settings: SettingsConfig;
  providers: ProviderStatus[];
}

interface SecretsState {
  providers: Record<string, string>;
}

interface TrustState {
  projects: Record<string, TrustConfig>;
}

interface ProjectFile {
  projectId: string;
  repoRoot: string;
  createdAt: string;
}

const DEFAULT_SETTINGS: SettingsConfig = {
  theme: "auto",
  secretsStorage: null,
};

const DEFAULT_PROVIDERS: ProviderStatus[] = [
  { provider: "openai", hasApiKey: false, isActive: false },
  { provider: "anthropic", hasApiKey: false, isActive: false },
  { provider: "gemini", hasApiKey: false, isActive: false },
  { provider: "openrouter", hasApiKey: false, isActive: false },
  { provider: "glm", hasApiKey: false, isActive: false },
];

const CONFIG_PATH = getGlobalConfigPath();
const SECRETS_PATH = getGlobalSecretsPath();
const TRUST_PATH = getGlobalTrustPath();

const cloneProviders = (providers: ProviderStatus[]): ProviderStatus[] =>
  providers.map((provider) => ({ ...provider }));

const loadConfig = (): ConfigState => {
  const stored = readJsonFileSync<ConfigState>(CONFIG_PATH);
  const settings = stored?.settings ?? DEFAULT_SETTINGS;
  const providers = stored?.providers ?? DEFAULT_PROVIDERS;

  return {
    settings: { ...settings },
    providers: cloneProviders(providers),
  };
};

const loadSecrets = (): SecretsState => {
  const stored = readJsonFileSync<SecretsState>(SECRETS_PATH);
  if (!stored?.providers) {
    return { providers: {} };
  }

  return { providers: { ...stored.providers } };
};

const loadTrust = (): TrustState => {
  const stored = readJsonFileSync<TrustState>(TRUST_PATH);
  if (!stored?.projects) {
    return { projects: {} };
  }

  return { projects: { ...stored.projects } };
};

const syncProvidersWithSecrets = (
  providers: ProviderStatus[],
  secrets: SecretsState,
): ProviderStatus[] => {
  const providerIds = new Set(providers.map((provider) => provider.provider));
  const nextProviders = providers.map((provider) => ({
    ...provider,
    hasApiKey: secrets.providers[provider.provider] !== undefined,
  }));

  for (const providerId of Object.keys(secrets.providers)) {
    if (providerIds.has(providerId)) continue;
    nextProviders.push({
      provider: providerId,
      hasApiKey: true,
      isActive: false,
    });
  }

  return nextProviders;
};

let configState: ConfigState = loadConfig();
let secretsState: SecretsState = loadSecrets();
let trustState: TrustState = loadTrust();

configState.providers = syncProvidersWithSecrets(
  configState.providers,
  secretsState,
);

const persistConfig = (): void => {
  writeJsonFileSync(CONFIG_PATH, configState, 0o600);
};

const persistSecrets = (): void => {
  writeJsonFileSync(SECRETS_PATH, secretsState, 0o600);
};

const persistTrust = (): void => {
  writeJsonFileSync(TRUST_PATH, trustState, 0o600);
};

const ensureProvider = (providerId: string): ProviderStatus => {
  const existing = configState.providers.find(
    (provider) => provider.provider === providerId,
  );
  if (existing) return existing;

  const created: ProviderStatus = {
    provider: providerId,
    hasApiKey: secretsState.providers[providerId] !== undefined,
    isActive: false,
  };

  configState.providers = [...configState.providers, created];
  return created;
};

const readOrCreateProjectFile = (projectRoot: string): ProjectFile => {
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

export const getSettings = (): SettingsConfig => ({ ...configState.settings });

export const updateSettings = (
  patch: Partial<SettingsConfig>,
): SettingsConfig => {
  configState.settings = {
    ...configState.settings,
    ...patch,
  };

  persistConfig();
  return getSettings();
};

export const getProviders = (): ProviderStatus[] =>
  cloneProviders(configState.providers);

export const getActiveProvider = (): ProviderStatus | null => {
  const active = configState.providers.find((provider) => provider.isActive);
  return active ? { ...active } : null;
};

export const getProjectInfo = (projectRoot?: string): ProjectInfo => {
  const resolvedRoot = resolveProjectRoot({
    header: projectRoot ?? null,
    env: process.env.STARGAZER_PROJECT_ROOT ?? null,
    cwd: process.cwd(),
  });
  const projectFile = readOrCreateProjectFile(resolvedRoot);
  const trust = trustState.projects[projectFile.projectId] ?? null;

  return {
    path: resolvedRoot,
    projectId: projectFile.projectId,
    trust,
  };
};

export const saveProviderCredentials = (input: {
  provider: string;
  apiKey: string;
  model?: string;
}): ProviderStatus => {
  const { provider, apiKey, model } = input;

  secretsState.providers[provider] = apiKey;

  configState.providers = configState.providers.map((item) => {
    if (item.provider !== provider) {
      return { ...item, isActive: false };
    }

    return {
      ...item,
      hasApiKey: true,
      isActive: true,
      model,
    };
  });

  const active = ensureProvider(provider);
  active.hasApiKey = true;
  active.isActive = true;
  active.model = model;

  persistSecrets();
  persistConfig();
  return { ...active };
};

export const activateProvider = (input: {
  provider: string;
  model?: string;
}): ProviderStatus | null => {
  const { provider, model } = input;
  const existing = configState.providers.find(
    (item) => item.provider === provider,
  );
  if (!existing) return null;

  configState.providers = configState.providers.map((item) => {
    if (item.provider !== provider) {
      return { ...item, isActive: false };
    }

    return {
      ...item,
      isActive: true,
      model: model ?? item.model,
    };
  });

  persistConfig();
  return getActiveProvider();
};

export const deleteProviderCredentials = (providerId: string): boolean => {
  const providerExists = configState.providers.some(
    (item) => item.provider === providerId,
  );
  const hadSecret = providerId in secretsState.providers;

  if (hadSecret) {
    delete secretsState.providers[providerId];
  }

  configState.providers = configState.providers.map((item) => {
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

  if (Object.keys(secretsState.providers).length === 0) {
    removeFileSync(SECRETS_PATH);
  } else {
    persistSecrets();
  }

  persistConfig();
  return providerExists || hadSecret;
};

export const resetConfigStore = (): void => {
  configState = {
    settings: { ...DEFAULT_SETTINGS },
    providers: cloneProviders(DEFAULT_PROVIDERS),
  };
  secretsState = { providers: {} };
  trustState = { projects: {} };

  persistConfig();
  persistSecrets();
  persistTrust();
};
