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

// Record-level tolerance (F-445): the config/secrets files are parsed element-
// wise, not whole-file. The top-level container is read loosely so a single
// unknown provider/settings/secret value never resets the file; only JSON
// corruption quarantines. Per-field/per-entry schemas validate each record. Each
// container slot falls back independently, so a malformed providers array never
// also discards valid settings (and vice versa).
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
  .refine((id) => !RESERVED_PROJECT_IDS.has(id), { message: "projectId is reserved" });

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

/**
 * Reads a record-tolerant file: returns the raw parsed JSON, quarantining ONLY
 * when JSON.parse fails. Schema validation is left to the caller's per-record
 * parse so a single unknown value never resets the whole file (F-445).
 */
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

// Parse the providers array element-wise: each entry that validates against the
// current schema becomes a typed provider; entries that do not (a provider id or
// shape this binary does not know) are carried opaquely so persist re-emits them
// instead of destroying a newer binary's state (F-445). Defaults fill the gaps.
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

// Parse settings field-wise: each known field that validates is taken, otherwise
// it falls back to the default for that field; unrecognized fields are preserved
// for round-trip. One bad value never resets every setting (F-445).
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

  // Parse each secret entry on its own: literal keys and env refs are typed,
  // unknown ref kinds (a newer reference type) are carried opaquely so they
  // round-trip on persist instead of failing the whole file (F-445).
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

// Builds the on-disk config shape, re-emitting the opaque unknown settings
// fields and provider entries a newer binary wrote so they survive a round-trip
// through this binary (F-445).
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

// Merge the settings object against disk field-by-field like providers: a field
// this instance changed (current value differs from the pre-mutation snapshot)
// overwrites disk; a field it left untouched yields to the freshly-read disk
// value so a concurrent instance's change to a DIFFERENT field survives (F-359).
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

// Merge unknown (round-tripped) settings keys per key against disk: this binary
// never mutates fields it does not recognize, so every key it carries is by
// definition unchanged and yields to the freshly-read disk value, mirroring the
// per-field merge so a concurrent instance's unknown-key write survives (F-359).
const mergeUnknownSettings = (
  disk: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined =>
  disk && Object.keys(disk).length > 0 ? { ...disk } : undefined;

/**
 * Persists config state, re-reading config.json immediately before the atomic
 * write and merging at record granularity (F-359): per-provider entries and the
 * settings object field-by-field. Because every load materializes all known
 * provider ids, an absent-id append can never carry a concurrent instance's
 * change to a known provider; instead each provider this instance did not change
 * (its current entry still matches `previousProviders`, the pre-mutation
 * snapshot) yields to the freshly-read disk entry, so another instance's
 * hasApiKey/isActive/model change written during this window survives. Providers
 * this instance did change overwrite disk; ids only this instance knows are
 * appended. Settings merge the same way against `previousSettings`: a field this
 * instance changed overwrites disk, an untouched field yields to the freshly-read
 * disk value, so two instances editing different settings fields don't clobber.
 */
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

/**
 * Persists a single trust record, re-reading trust.json immediately before the
 * atomic write and merging at record granularity (F-359). A record another
 * diffgazer instance persisted during this instance's read-modify-write window
 * survives because the merge starts from the freshly-read disk state.
 */
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
    // The directory moved: project.json travels with the repo so its stored
    // repoRoot is stale by construction. Keep the identity (projectId) and
    // re-point repoRoot at the current root instead of quarantining (F-447).
    // Trust stays gated — the trust record still names the old root, so the
    // trust-guard 403s until the user explicitly re-confirms, preserving the
    // anti-trust-transfer property — but the user's own review history follows.
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
