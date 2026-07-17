import { randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { isDeepStrictEqual } from "node:util";
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
  isNodeError,
  quarantineCorruptFile,
  readJsonFileSyncSafe,
  removeFileSync,
  writeJsonFile,
  writeJsonFileSync,
  writeJsonFileSyncExclusive,
} from "../fs.js";
import { log } from "../log.js";
import {
  getGlobalConfigPath,
  getGlobalSecretsPath,
  getGlobalTrustPath,
  getProjectInfoPath,
} from "../paths.js";
import { withFileTransactionLock } from "./transaction.js";
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

const PersistedEnvCredentialRefSchema = z
  .object({
    kind: z.literal("env"),
    varName: z.string().min(1),
  })
  .strict();

const PersistedLiteralSecretSchema = z
  .string()
  .refine((value) => value.trim().length > 0, { error: "API key must not be empty" });

const SecretEntrySchema = z.union([PersistedLiteralSecretSchema, PersistedEnvCredentialRefSchema]);

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

interface ParsedProviders {
  providers: ProviderStatus[];
  unknown: unknown[];
}

type ActiveProviderSelection =
  | { kind: "known"; provider: AIProvider }
  | { kind: "opaque"; index: number };

const isOpaqueProviderActive = (
  entry: unknown,
): entry is Record<string, unknown> & { isActive: true } =>
  typeof entry === "object" &&
  entry !== null &&
  !Array.isArray(entry) &&
  "isActive" in entry &&
  entry.isActive === true;

const deactivateOpaqueProvider = (entry: unknown): unknown => {
  if (!isOpaqueProviderActive(entry)) return entry;
  return { ...entry, isActive: false };
};

// Element-wise parse: valid entries become typed providers; unknown ones are carried
// opaquely so persist re-emits them instead of destroying a newer binary's state (F-445).
const parseProviders = (rawProviders: unknown[]): ParsedProviders => {
  const byId = new Map<string, ProviderStatus>();
  const unknown: unknown[] = [];
  let activeSelection: ActiveProviderSelection | null = null;
  let activeCount = 0;

  for (const entry of rawProviders) {
    const parsed = ProviderStatusSchema.safeParse(entry);
    if (parsed.success) {
      byId.set(parsed.data.provider, parsed.data);
      if (parsed.data.isActive) {
        activeCount += 1;
        activeSelection ??= { kind: "known", provider: parsed.data.provider };
      }
    } else {
      const opaqueIndex = unknown.length;
      unknown.push(entry);
      if (isOpaqueProviderActive(entry)) {
        activeCount += 1;
        activeSelection ??= { kind: "opaque", index: opaqueIndex };
      }
    }
  }

  const providers = DEFAULT_PROVIDERS.map((provider) => {
    const stored = byId.get(provider.provider);
    return {
      ...provider,
      ...stored,
      isActive: activeSelection?.kind === "known" && activeSelection.provider === provider.provider,
    };
  });
  const normalizedUnknown = unknown.map((entry, index) =>
    activeSelection?.kind === "opaque" && activeSelection.index === index
      ? entry
      : deactivateOpaqueProvider(entry),
  );

  if (activeCount > 1) {
    log("warn", "config_multiple_active_providers_repaired");
  }

  return { providers, unknown: normalizedUnknown };
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

const parseConfigContainer = (
  stored: z.infer<typeof RawConfigContainerSchema> = {},
): ConfigState => {
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

export const parseConfigData = (data: unknown): ConfigState => {
  const parsed = RawConfigContainerSchema.safeParse(data);
  return parseConfigContainer(parsed.success ? parsed.data : {});
};

export const loadConfig = (): ConfigState => {
  const stored = loadOrQuarantine(CONFIG_PATH(), "config", RawConfigContainerSchema) ?? {};
  return parseConfigContainer(stored);
};

const parseSecretsContainer = (
  stored: z.infer<typeof RawSecretsContainerSchema> | null,
): SecretsState => {
  const storedProviders = stored?.providers ?? {};

  // Unknown providers and refs that fail the provider allowlist stay opaque and round-trip.
  const migrated: SecretsState["providers"] = {};
  const unknown: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(storedProviders)) {
    if (!isValidAIProvider(key)) {
      unknown[key] = value;
      continue;
    }

    // Migrate legacy "env" sentinel strings to structured env refs.
    if (value === "env") {
      migrated[key] = { kind: "env", varName: PROVIDER_ENV_VARS[key] };
      continue;
    }
    const parsed = SecretEntrySchema.safeParse(value);
    if (!parsed.success) {
      unknown[key] = value;
      continue;
    }
    if (typeof parsed.data !== "string" && parsed.data.varName !== PROVIDER_ENV_VARS[key]) {
      unknown[key] = value;
      continue;
    }
    migrated[key] = parsed.data;
  }

  return {
    providers: migrated,
    ...(Object.keys(unknown).length > 0 ? { unknownSecrets: unknown } : {}),
  };
};

export const parseSecretsData = (data: unknown): SecretsState => {
  const parsed = RawSecretsContainerSchema.safeParse(data);
  return parseSecretsContainer(parsed.success ? parsed.data : null);
};

export const loadSecrets = (): SecretsState => {
  const stored = loadOrQuarantine(SECRETS_PATH(), "secrets", RawSecretsContainerSchema);
  return parseSecretsContainer(stored);
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
): { settings: Record<string, unknown>; providers: unknown[] } => {
  const canonicalSettings = SettingsConfigSchema.parse(settings);
  const activeProviderCount =
    providers.filter((provider) => provider.isActive).length +
    (unknownProviders ?? []).filter(isOpaqueProviderActive).length;
  if (activeProviderCount > 1) {
    throw new Error("Config cannot persist more than one active provider");
  }

  return {
    settings: { ...unknownSettings, ...canonicalSettings },
    providers: [...providers, ...(unknownProviders ?? [])],
  };
};

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

export type PersistConfigMerged = (
  state: ConfigState,
  previousProviders: ProviderStatus[],
  previousSettings: SettingsConfig,
) => Promise<ConfigState>;

// Re-reads config.json before the atomic write and merges at record granularity
// (F-359): a provider this instance didn't change (still matches previousProviders)
// yields to the freshly-read disk entry so a concurrent change survives; changed
// providers overwrite disk; unknown ids are appended. Settings merge the same way.
// The caller must hold CONFIG_PATH's transaction lock for this entire operation.
const persistConfigMergedUnlockedAsync: PersistConfigMerged = async (
  state,
  previousProviders,
  previousSettings,
) => {
  if (state.providers.filter((provider) => provider.isActive).length > 1) {
    throw new Error("Config cannot persist more than one active provider");
  }

  const disk = loadConfig();
  const diskById = new Map(disk.providers.map((provider) => [provider.provider, provider]));
  const previousById = new Map(previousProviders.map((provider) => [provider.provider, provider]));

  let merged: ProviderStatus[] = state.providers.map((provider) => {
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

  const activeSelectionChanged = state.providers.some((provider) => {
    const previous = previousById.get(provider.provider);
    return previous !== undefined && provider.isActive !== previous.isActive;
  });
  const selectedProviderId = activeSelectionChanged
    ? state.providers.find((provider) => provider.isActive)?.provider
    : disk.providers.find((provider) => provider.isActive)?.provider;
  merged = merged.map((provider) => ({
    ...provider,
    isActive: provider.provider === selectedProviderId,
  }));

  const diskUnknownProviders = disk.unknownProviders;
  const unknownProviders = activeSelectionChanged
    ? diskUnknownProviders?.map(deactivateOpaqueProvider)
    : diskUnknownProviders;

  const settings = SettingsConfigSchema.parse(
    mergeSettings(state.settings, previousSettings, disk.settings),
  );
  const persistedState: ConfigState = {
    settings,
    providers: merged,
    ...(unknownProviders ? { unknownProviders } : {}),
    ...(disk.unknownSettings ? { unknownSettings: disk.unknownSettings } : {}),
  };

  await writeJsonFile(
    CONFIG_PATH(),
    serializeConfig(settings, merged, mergeUnknownSettings(disk.unknownSettings), unknownProviders),
    0o600,
  );
  return persistedState;
};

export const withConfigFileTransaction = <T>(
  operation: (persistMerged: PersistConfigMerged) => Promise<T>,
): Promise<T> =>
  withFileTransactionLock(CONFIG_PATH(), async () => {
    let active = true;
    const acceptedWriteSettlements: Promise<void>[] = [];
    const persistMerged: PersistConfigMerged = (state, previousProviders, previousSettings) => {
      if (!active) {
        return Promise.reject(new Error("Config transaction writer lease expired"));
      }

      const write = persistConfigMergedUnlockedAsync(state, previousProviders, previousSettings);
      acceptedWriteSettlements.push(
        write.then(
          () => undefined,
          () => undefined,
        ),
      );
      return write;
    };

    try {
      return await operation(persistMerged);
    } finally {
      active = false;
      await Promise.all(acceptedWriteSettlements);
    }
  });

// Direct callers still receive a complete locked read-merge-write transaction. Store
// mutations use withConfigFileTransaction so their refresh and mutation are covered too.
export const persistConfigMergedAsync: PersistConfigMerged = (
  state,
  previousProviders,
  previousSettings,
) =>
  withConfigFileTransaction((persistMerged) =>
    persistMerged(state, previousProviders, previousSettings),
  );

const serializeSecrets = (state: SecretsState): { providers: Record<string, unknown> } => ({
  providers: { ...state.unknownSecrets, ...state.providers },
});

const mergeChangedRecords = (
  state: Record<string, unknown>,
  previous: Record<string, unknown>,
  disk: Record<string, unknown>,
): Record<string, unknown> => {
  const merged = { ...disk };
  const keys = new Set([...Object.keys(previous), ...Object.keys(state)]);
  for (const key of keys) {
    const stateHasKey = Object.hasOwn(state, key);
    const previousHasKey = Object.hasOwn(previous, key);
    const changed =
      stateHasKey !== previousHasKey ||
      (stateHasKey && previousHasKey && !isDeepStrictEqual(state[key], previous[key]));
    if (!changed) continue;
    if (stateHasKey) {
      merged[key] = state[key];
    } else {
      delete merged[key];
    }
  }
  return merged;
};

export const persistSecrets = (state: SecretsState): void => {
  writeJsonFileSync(SECRETS_PATH(), serializeSecrets(state), 0o600);
};

export const persistSecretsAsync = (
  state: SecretsState,
  previousState: SecretsState = { providers: {} },
): Promise<void> =>
  withFileTransactionLock(SECRETS_PATH(), async () => {
    const disk = loadSecrets();
    const providers = mergeChangedRecords(
      serializeSecrets(state).providers,
      serializeSecrets(previousState).providers,
      serializeSecrets(disk).providers,
    );
    if (Object.keys(providers).length === 0) {
      removeFileSync(SECRETS_PATH());
      return;
    }
    await writeJsonFile(SECRETS_PATH(), { providers }, 0o600);
  });

export const persistTrust = (state: TrustState): void => {
  writeJsonFileSync(TRUST_PATH(), state, 0o600);
};

// Re-reads trust.json before the atomic write so a record another instance persisted
// during this read-modify-write window survives (F-359).
export const persistTrustRecordAsync = (config: TrustConfig): Promise<void> => {
  return withFileTransactionLock(TRUST_PATH(), async () => {
    const disk = loadTrust();
    disk.projects[config.projectId] = config;
    await writeJsonFile(TRUST_PATH(), disk, 0o600);
  });
};

/** Removes a single trust record, re-reading and merging at record granularity (F-359). */
export const persistTrustRemovalAsync = (projectId: string): Promise<void> => {
  return withFileTransactionLock(TRUST_PATH(), async () => {
    const disk = loadTrust();
    delete disk.projects[projectId];
    await writeJsonFile(TRUST_PATH(), disk, 0o600);
  });
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

/** Migrates moved-project state and reports when project.json may commit the new root. */
export interface ReadProjectFileOptions {
  onMove?: (oldRepoRoot: string, newRepoRoot: string) => Promise<boolean>;
}

const projectMoveFlights = new Map<string, Promise<void>>();

function scheduleProjectMove(
  projectInfoPath: string,
  current: ProjectFile,
  moved: ProjectFile,
  onMove: NonNullable<ReadProjectFileOptions["onMove"]>,
): void {
  if (projectMoveFlights.has(projectInfoPath)) return;

  const flight = onMove(current.repoRoot, moved.repoRoot)
    .then((completed) => {
      if (!completed) return;
      const latest = loadOrQuarantine(projectInfoPath, "project file", ProjectFileSchema);
      if (
        !latest ||
        latest.projectId !== current.projectId ||
        latest.repoRoot !== current.repoRoot
      ) {
        return;
      }
      writeJsonFileSync(projectInfoPath, moved, 0o600);
    })
    .catch((error) => {
      log("warn", "review_rekey_failed", { error });
    })
    .finally(() => {
      projectMoveFlights.delete(projectInfoPath);
    });
  projectMoveFlights.set(projectInfoPath, flight);
}

export const readProjectFile = (
  projectRoot: string,
  options: ReadProjectFileOptions = {},
): ProjectFile | null => {
  const projectInfoPath = getProjectInfoPath(projectRoot);
  const loaded = loadOrQuarantine(projectInfoPath, "project file", ProjectFileSchema);
  if (!loaded) return null;
  if (!projectFileMatchesRoot(loaded, projectRoot)) {
    // The repo moved: keep the projectId identity while review history migrates.
    // Trust stays gated on the old root until the migration completes and the user
    // re-confirms it, preserving anti-trust-transfer.
    const moved: ProjectFile = { ...loaded, repoRoot: projectRoot };
    if (options.onMove) {
      scheduleProjectMove(projectInfoPath, loaded, moved, options.onMove);
    } else {
      writeJsonFileSync(projectInfoPath, moved, 0o600);
    }
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

  try {
    writeJsonFileSyncExclusive(getProjectInfoPath(projectRoot), created, 0o600);
    return created;
  } catch (error) {
    if (!isNodeError(error, "EEXIST")) throw error;

    const winner = readProjectFile(projectRoot, options);
    if (winner) return winner;
    throw new Error("Project identity winner could not be read after exclusive creation", {
      cause: error,
    });
  }
};
