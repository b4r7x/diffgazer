import {
  AI_PROVIDERS,
  type AIProvider,
  ProviderStatusSchema,
  type ProviderStatus,
  SettingsConfigSchema,
  type SettingsConfig,
} from "@diffgazer/core/schemas/config";
import { z } from "zod";
import { writeJsonFile, writeJsonFileSync } from "../../fs.js";
import { log } from "../../log.js";
import { getGlobalConfigPath } from "../../paths.js";
import { withFileTransactionLock } from "../transaction/file-lock.js";
import type { ConfigState } from "../types.js";
import { loadOrQuarantine } from "./load-json.js";

const RawConfigContainerSchema = z.object({
  settings: z.record(z.string(), z.unknown()).catch({}).optional(),
  providers: z.array(z.unknown()).catch([]).optional(),
});

const SettingsFieldSchemas = SettingsConfigSchema.shape;

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

const CONFIG_PATH = (): string => {
  _configPath ??= getGlobalConfigPath();
  return _configPath;
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

const mergeUnknownSettings = (
  disk: Record<string, unknown> | undefined,
): Record<string, unknown> | undefined =>
  disk && Object.keys(disk).length > 0 ? { ...disk } : undefined;

export type PersistConfigMerged = (
  state: ConfigState,
  previousProviders: ProviderStatus[],
  previousSettings: SettingsConfig,
) => Promise<ConfigState>;

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

export const persistConfigMergedAsync: PersistConfigMerged = (
  state,
  previousProviders,
  previousSettings,
) =>
  withConfigFileTransaction((persistMerged) =>
    persistMerged(state, previousProviders, previousSettings),
  );
