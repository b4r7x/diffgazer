import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import {
  AI_PROVIDERS,
  type AIProvider,
  PROVIDER_ENV_VARS,
  type ProviderStatus,
  ProviderStatusSchema,
  type SecretsStorage,
  type SettingsConfig,
  SettingsConfigSchema,
  type TrustConfig,
  TrustConfigSchema,
} from "@diffgazer/core/schemas/config";
import { z } from "zod";
import {
  quarantineCorruptFile,
  readJsonFileSyncSafe,
  removeFileSync,
  writeJsonFile,
  writeJsonFileSync,
} from "../fs.js";
import { log } from "../log.js";
import {
  getGlobalConfigPath,
  getGlobalSecretsPath,
  getGlobalTrustPath,
  getProjectInfoPath,
} from "../paths.js";
import type { ConfigState, ProjectFile, SecretsState, TrustState } from "./types.js";

const isValidAIProvider = (value: string): value is AIProvider => {
  return AI_PROVIDERS.includes(value as AIProvider);
};

// Record-level tolerance (F-445): the container is read loosely so one unknown
// value never resets the file; only JSON corruption quarantines. Per-field/per-entry
// schemas validate each record, and each slot falls back independently.
const RawConfigContainerSchema = z.object({
  settings: z.record(z.string(), z.unknown()).catch({}).optional(),
  providers: z.array(z.unknown()).catch([]).optional(),
});

const SettingsFieldSchemas = SettingsConfigSchema.shape;

const PersistedEnvCredentialRefSchema = z.object({
  kind: z.literal("env"),
  varName: z.string().min(1),
});

const SecretEntrySchema = z.union([z.string(), PersistedEnvCredentialRefSchema]);

const RawSecretsContainerSchema = z.object({
  providers: z.record(z.string(), z.unknown()).catch({}).optional(),
});

const PersistedTrustStateSchema = z.object({
  projects: z.record(z.string(), z.unknown()).optional(),
});

const RESERVED_PROJECT_IDS = new Set(["__proto__", "constructor", "prototype"]);

const SafeProjectIdSchema = z
  .string()
  .min(1)
  .refine((id) => !RESERVED_PROJECT_IDS.has(id), { error: "projectId is reserved" });

const ProjectFileSchema = z.object({
  projectId: SafeProjectIdSchema,
  repoRoot: z.string().min(1),
  createdAt: z.string().min(1),
});

const resolveProjectRootPath = (projectRoot: string): string => {
  try {
    return realpathSync(resolve(projectRoot));
  } catch {
    return resolve(projectRoot);
  }
};

const projectFileMatchesRoot = (file: ProjectFile, projectRoot: string): boolean => {
  const resolvedProject = resolveProjectRootPath(projectRoot);
  try {
    return realpathSync(resolve(file.repoRoot)) === resolvedProject;
  } catch {
    return resolve(file.repoRoot) === resolvedProject;
  }
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

const CONFIG_PATH = (): string => {
  _configPath ??= getGlobalConfigPath();
  return _configPath;
};
const SECRETS_PATH = (): string => {
  _secretsPath ??= getGlobalSecretsPath();
  return _secretsPath;
};
const TRUST_PATH = (): string => {
  _trustPath ??= getGlobalTrustPath();
  return _trustPath;
};

const formatSchemaIssues = (error: z.ZodError): string =>
  error.issues
    .map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join(".") : "<root>";
      return `${path}: ${issue.message}`;
    })
    .join("; ");

const loadOrQuarantine = <T>(filePath: string, label: string, schema: z.ZodType<T>): T | null => {
  const result = readJsonFileSyncSafe<unknown>(filePath);
  if (result.status === "ok") {
    const parsed = schema.safeParse(result.data);
    if (parsed.success) return parsed.data;
    const backupPath = quarantineCorruptFile(filePath);
    log("warn", "config_invalid_quarantined", {
      label,
      filePath,
      backupPath,
      issues: formatSchemaIssues(parsed.error),
    });
    return null;
  }
  if (result.status === "missing") return null;
  const backupPath = quarantineCorruptFile(filePath);
  log("warn", "config_corrupt_quarantined", { label, filePath, backupPath });
  return null;
};

// Returns raw parsed JSON, quarantining ONLY on JSON.parse failure; per-record
// validation is left to the caller so one unknown value never resets the file (F-445).
const loadRawOrQuarantine = (filePath: string, label: string): unknown => {
  const result = readJsonFileSyncSafe<unknown>(filePath);
  if (result.status === "ok") return result.data;
  if (result.status === "missing") return null;
  const backupPath = quarantineCorruptFile(filePath);
  log("warn", "config_corrupt_quarantined", { label, filePath, backupPath });
  return null;
};

interface ParsedProviders {
  providers: ProviderStatus[];
  unknown: unknown[];
}

// Element-wise parse: valid entries become typed providers; unknown ones are carried
// opaquely so persist re-emits them instead of destroying a newer binary's state (F-445).
const parseProviders = (rawProviders: unknown[]): ParsedProviders => {
  const byId = new Map<string, ProviderStatus>();
  const unknown: unknown[] = [];
  for (const entry of rawProviders) {
    const parsed = ProviderStatusSchema.safeParse(entry);
    if (parsed.success) {
      byId.set(parsed.data.provider, parsed.data);
    } else {
      unknown.push(entry);
    }
  }

  const providers = DEFAULT_PROVIDERS.map((provider) => ({
    ...provider,
    ...byId.get(provider.provider),
  }));

  return { providers, unknown };
};

interface ParsedSettings {
  settings: SettingsConfig;
  unknown: Record<string, unknown>;
}

// Field-wise parse: invalid known fields fall back to their default, unrecognized
// fields are preserved for round-trip, so one bad value never resets every setting (F-445).
const parseSettings = (rawSettings: Record<string, unknown>): ParsedSettings => {
  const settings = { ...DEFAULT_SETTINGS };
  const unknown: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rawSettings)) {
    const fieldSchema = (SettingsFieldSchemas as Record<string, z.ZodType>)[key];
    if (!fieldSchema) {
      unknown[key] = value;
      continue;
    }
    const parsed = fieldSchema.safeParse(value);
    if (parsed.success) {
      (settings as Record<string, unknown>)[key] = parsed.data;
    }
  }

  return { settings, unknown };
};

export const loadConfig = (): ConfigState => {
  const raw = loadRawOrQuarantine(CONFIG_PATH(), "config");
  const container = RawConfigContainerSchema.safeParse(raw);
  const stored = container.success ? container.data : {};

  const { settings, unknown: unknownSettings } = parseSettings(stored.settings ?? {});
  const { providers, unknown: unknownProviders } = parseProviders(
    stored.providers ?? DEFAULT_PROVIDERS,
  );

  return {
    settings,
    providers,
    ...(unknownProviders.length > 0 ? { unknownProviders } : {}),
    ...(Object.keys(unknownSettings).length > 0 ? { unknownSettings } : {}),
  };
};

export const loadSecrets = (): SecretsState => {
  const raw = loadRawOrQuarantine(SECRETS_PATH(), "secrets");
  const container = RawSecretsContainerSchema.safeParse(raw);
  const storedProviders = container.success ? (container.data.providers ?? {}) : {};

  // Per-entry parse: unknown ref kinds are carried opaquely to round-trip on persist (F-445).
  const migrated: SecretsState["providers"] = {};
  const unknown: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(storedProviders)) {
    // Migrate legacy "env" sentinel strings to structured env refs.
    if (value === "env") {
      const isProvider = isValidAIProvider(key);
      const varName = isProvider ? PROVIDER_ENV_VARS[key] : key.toUpperCase();
      migrated[key] = { kind: "env", varName };
      continue;
    }
    const parsed = SecretEntrySchema.safeParse(value);
    if (parsed.success) {
      migrated[key] = parsed.data;
    } else {
      unknown[key] = value;
    }
  }

  return {
    providers: migrated,
    ...(Object.keys(unknown).length > 0 ? { unknownSecrets: unknown } : {}),
  };
};

const validateTrustRecord = (projectId: string, raw: unknown): TrustConfig | null => {
  const result = TrustConfigSchema.safeParse(raw);
  if (result.success) return result.data;
  log("warn", "config_trust_record_invalid", { projectId, error: result.error.message });
  return null;
};

export const loadTrust = (): TrustState => {
  const stored = loadOrQuarantine(TRUST_PATH(), "trust", PersistedTrustStateSchema);
  if (!stored?.projects) {
    return { projects: {} };
  }

  const validated: Record<string, TrustConfig> = {};
  for (const [projectId, config] of Object.entries(stored.projects)) {
    if (RESERVED_PROJECT_IDS.has(projectId)) {
      log("warn", "config_trust_record_reserved_id", { projectId });
      continue;
    }
    const record = validateTrustRecord(projectId, config);
    if (record) validated[projectId] = record;
  }

  return { projects: validated };
};

// Re-emits opaque unknown settings/provider entries a newer binary wrote so they round-trip (F-445).
const serializeConfig = (
  settings: SettingsConfig,
  providers: ProviderStatus[],
  unknownSettings: Record<string, unknown> | undefined,
  unknownProviders: unknown[] | undefined,
): { settings: Record<string, unknown>; providers: unknown[] } => ({
  settings: { ...unknownSettings, ...settings },
  providers: [...providers, ...(unknownProviders ?? [])],
});

export const persistConfig = (state: ConfigState): void => {
  writeJsonFileSync(
    CONFIG_PATH(),
    serializeConfig(state.settings, state.providers, state.unknownSettings, state.unknownProviders),
    0o600,
  );
};

const providerEntriesEqual = (a: ProviderStatus, b: ProviderStatus): boolean =>
  a.hasApiKey === b.hasApiKey && a.isActive === b.isActive && a.model === b.model;

// Field-by-field merge against disk: a field this instance changed (differs from the
// pre-mutation snapshot) overwrites disk; an untouched field yields to the freshly-read
// disk value so a concurrent instance's change to a different field survives (F-359).
const mergeSettings = (
  state: SettingsConfig,
  previous: SettingsConfig,
  disk: SettingsConfig,
): SettingsConfig => {
  const merged = {} as SettingsConfig;
  for (const key of Object.keys(DEFAULT_SETTINGS) as (keyof SettingsConfig)[]) {
    const changedByThisInstance = !Object.is(state[key], previous[key]);
    (merged as Record<string, unknown>)[key] = changedByThisInstance ? state[key] : disk[key];
  }
  return merged;
};

// This binary never mutates unrecognized keys, so they always yield to the
// freshly-read disk value, letting a concurrent instance's unknown-key write survive (F-359).
const mergeUnknownSettings = (
  disk: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined =>
  disk && Object.keys(disk).length > 0 ? { ...disk } : undefined;

// Re-reads config.json before the atomic write and merges at record granularity
// (F-359): a provider this instance didn't change (still matches previousProviders)
// yields to the freshly-read disk entry so a concurrent change survives; changed
// providers overwrite disk; unknown ids are appended. Settings merge the same way.
export const persistConfigMergedAsync = (
  state: ConfigState,
  previousProviders: ProviderStatus[],
  previousSettings: SettingsConfig,
): Promise<void> => {
  const disk = loadConfig();
  const diskById = new Map(disk.providers.map((provider) => [provider.provider, provider]));
  const previousById = new Map(previousProviders.map((provider) => [provider.provider, provider]));

  const merged: ProviderStatus[] = state.providers.map((provider) => {
    const diskProvider = diskById.get(provider.provider);
    const previousProvider = previousById.get(provider.provider);
    const unchangedByThisInstance =
      diskProvider !== undefined &&
      previousProvider !== undefined &&
      providerEntriesEqual(provider, previousProvider);
    return unchangedByThisInstance ? { ...diskProvider } : { ...provider };
  });

  const knownIds = new Set(state.providers.map((provider) => provider.provider));
  for (const diskProvider of disk.providers) {
    if (!knownIds.has(diskProvider.provider)) {
      merged.push({ ...diskProvider });
    }
  }

  return writeJsonFile(
    CONFIG_PATH(),
    serializeConfig(
      mergeSettings(state.settings, previousSettings, disk.settings),
      merged,
      mergeUnknownSettings(disk.unknownSettings),
      state.unknownProviders ?? disk.unknownProviders,
    ),
    0o600,
  );
};

const serializeSecrets = (state: SecretsState): Record<string, unknown> => ({
  providers: { ...state.unknownSecrets, ...state.providers },
});

export const persistSecrets = (state: SecretsState): void => {
  writeJsonFileSync(SECRETS_PATH(), serializeSecrets(state), 0o600);
};

export const persistSecretsAsync = (state: SecretsState): Promise<void> =>
  writeJsonFile(SECRETS_PATH(), serializeSecrets(state), 0o600);

export const persistTrust = (state: TrustState): void => {
  writeJsonFileSync(TRUST_PATH(), state, 0o600);
};

// Re-reads trust.json before the atomic write so a record another instance persisted
// during this read-modify-write window survives (F-359).
export const persistTrustRecordAsync = (config: TrustConfig): Promise<void> => {
  const disk = loadTrust();
  disk.projects[config.projectId] = config;
  return writeJsonFile(TRUST_PATH(), disk, 0o600);
};

/** Removes a single trust record, re-reading and merging at record granularity (F-359). */
export const persistTrustRemovalAsync = (projectId: string): Promise<void> => {
  const disk = loadTrust();
  delete disk.projects[projectId];
  return writeJsonFile(TRUST_PATH(), disk, 0o600);
};

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

/** Notified when a moved repository's project.json is re-keyed (F-447). */
export interface ReadProjectFileOptions {
  onMove?: (oldRepoRoot: string, newRepoRoot: string) => void;
}

export const readProjectFile = (
  projectRoot: string,
  options: ReadProjectFileOptions = {},
): ProjectFile | null => {
  const projectInfoPath = getProjectInfoPath(projectRoot);
  const loaded = loadOrQuarantine(projectInfoPath, "project file", ProjectFileSchema);
  if (!loaded) return null;
  if (!projectFileMatchesRoot(loaded, projectRoot)) {
    // The repo moved: keep the projectId identity and re-point repoRoot instead of
    // quarantining (F-447). Trust stays gated on the old root (trust-guard 403s until
    // re-confirmed), preserving anti-trust-transfer, but review history follows.
    const oldRepoRoot = loaded.repoRoot;
    const moved: ProjectFile = { ...loaded, repoRoot: projectRoot };
    writeJsonFileSync(projectInfoPath, moved, 0o600);
    options.onMove?.(oldRepoRoot, projectRoot);
    return moved;
  }
  return loaded;
};

export const createProjectFile = (
  projectRoot: string,
  options: ReadProjectFileOptions = {},
): ProjectFile => {
  const existing = readProjectFile(projectRoot, options);
  if (existing) return existing;

  const created: ProjectFile = {
    projectId: randomUUID(),
    repoRoot: projectRoot,
    createdAt: new Date().toISOString(),
  };

  writeJsonFileSync(getProjectInfoPath(projectRoot), created, 0o600);
  return created;
};
