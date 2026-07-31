import { readFileSync } from "node:fs";
import type { SettingsConfig } from "@diffgazer/core/schemas/config";
import {
  decodeProviderConfigurationRecord as decodeLegacyProviderConfigurationRecord,
  SettingsConfigSchema,
} from "@diffgazer/core/schemas/config";
import { z } from "zod";
import { atomicWriteFile, writeJsonFile } from "../../fs.js";
import { log } from "../../log.js";
import { getGlobalConfigPath } from "../../paths.js";
import {
  type DecodedProviderConfigurationRecord,
  decodeProviderConfigurationRecord,
  ProviderConfigurationConflictError,
  RemovedProviderConfigurationRecordSchema,
  SupportedProviderConfigurationRecordSchema,
} from "../provider-config.js";
import { withFileTransactionLock } from "../transaction/file-lock.js";
import {
  CONFIG_SCHEMA_VERSION_V2,
  type ConfigDocumentV1,
  type ConfigDocumentV2,
  type ConfigState,
  type V1ConfigurationRecord,
} from "../types.js";
import { loadOrQuarantine } from "./load-json.js";

type AIProvider = string;
type ProviderStatus = {
  provider: string;
  hasApiKey: boolean;
  isActive: boolean;
  model?: string;
};

const LegacyProviderStatusSchema = z.object({
  provider: z.string(),
  hasApiKey: z.boolean(),
  isActive: z.boolean(),
  model: z.string().optional(),
});
const ProviderStatusSchema = LegacyProviderStatusSchema;

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

const LEGACY_PROVIDER_IDS = ["gemini", "zai", "openrouter", "groq", "cerebras"] as const;

export const DEFAULT_PROVIDERS: ProviderStatus[] = LEGACY_PROVIDER_IDS.map((id) => ({
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

const MAX_V2_CONFIG_BYTES = 2 * 1024 * 1024;
const MAX_V2_RECORD_BYTES = 256 * 1024;
const V2_DOCUMENT_SNAPSHOT = Symbol("v2DocumentSnapshot");

interface V2DocumentSnapshot {
  readonly selectedConfigurationId: ConfigDocumentV2["selectedConfigurationId"];
  readonly settingsBytes: Uint8Array;
  readonly recordBytes: readonly Uint8Array[];
}

type V2DocumentWithSnapshot = ConfigDocumentV2 & {
  readonly [V2_DOCUMENT_SNAPSHOT]?: V2DocumentSnapshot;
};

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });

const copyBytes = (bytes: Uint8Array): Uint8Array => new Uint8Array(bytes);

const decodeConfigText = (bytes: Uint8Array): string => {
  try {
    return textDecoder.decode(bytes);
  } catch {
    throw new Error("Configuration file is not valid UTF-8");
  }
};

const skipJsonWhitespace = (text: string, start: number): number => {
  let cursor = start;
  while (cursor < text.length && " \t\n\r".includes(text[cursor] ?? "")) cursor += 1;
  return cursor;
};

const scanJsonStringEnd = (text: string, start: number): number => {
  if (text[start] !== '"') throw new Error("Expected a JSON string");
  let cursor = start + 1;
  let escaped = false;
  while (cursor < text.length) {
    const character = text[cursor];
    if (escaped) {
      escaped = false;
      cursor += 1;
      continue;
    }
    if (character === "\\") {
      escaped = true;
      cursor += 1;
      continue;
    }
    if (character === '"') return cursor + 1;
    if (character === undefined || character < " ") throw new Error("Invalid JSON string");
    cursor += 1;
  }
  throw new Error("Unterminated JSON string");
};

const scanJsonValueEnd = (text: string, start: number): number => {
  const valueStart = skipJsonWhitespace(text, start);
  const opening = text[valueStart];
  if (opening === '"') return scanJsonStringEnd(text, valueStart);
  if (opening !== "{" && opening !== "[") {
    let cursor = valueStart;
    while (cursor < text.length && !",]}".includes(text[cursor] ?? "")) cursor += 1;
    return cursor;
  }

  const stack = [opening === "{" ? "}" : "]"];
  let cursor = valueStart + 1;
  let inString = false;
  let escaped = false;
  while (cursor < text.length && stack.length > 0) {
    const character = text[cursor];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      cursor += 1;
      continue;
    }
    if (character === '"') {
      inString = true;
      cursor += 1;
      continue;
    }
    if (character === "{" || character === "[") stack.push(character === "{" ? "}" : "]");
    else if (character === "}" || character === "]") {
      if (stack.at(-1) !== character) throw new Error("Mismatched JSON container");
      stack.pop();
      if (stack.length === 0) return cursor + 1;
    }
    cursor += 1;
  }
  throw new Error("Unterminated JSON value");
};

interface JsonPropertySlice {
  readonly start: number;
  readonly end: number;
}

const scanJsonObjectProperties = (text: string): Map<string, JsonPropertySlice> => {
  const properties = new Map<string, JsonPropertySlice>();
  let cursor = skipJsonWhitespace(text, 0);
  if (text[cursor] !== "{") throw new Error("Configuration root must be an object");
  cursor = skipJsonWhitespace(text, cursor + 1);
  if (text[cursor] === "}") {
    if (skipJsonWhitespace(text, cursor + 1) !== text.length) {
      throw new Error("Unexpected trailing configuration input");
    }
    return properties;
  }

  while (cursor < text.length) {
    const keyEnd = scanJsonStringEnd(text, cursor);
    const key = JSON.parse(text.slice(cursor, keyEnd)) as string;
    if (properties.has(key)) throw new Error(`Duplicate configuration key: ${key}`);
    cursor = skipJsonWhitespace(text, keyEnd);
    if (text[cursor] !== ":") throw new Error("Invalid configuration object");
    const valueStart = skipJsonWhitespace(text, cursor + 1);
    const valueEnd = scanJsonValueEnd(text, valueStart);
    properties.set(key, { start: valueStart, end: valueEnd });
    cursor = skipJsonWhitespace(text, valueEnd);
    if (text[cursor] === "}") {
      if (skipJsonWhitespace(text, cursor + 1) !== text.length) {
        throw new Error("Unexpected trailing configuration input");
      }
      return properties;
    }
    if (text[cursor] !== ",") throw new Error("Invalid configuration object separator");
    cursor = skipJsonWhitespace(text, cursor + 1);
  }
  throw new Error("Unterminated configuration object");
};

const splitJsonArrayElements = (arrayText: string): Uint8Array[] => {
  let cursor = skipJsonWhitespace(arrayText, 0);
  if (arrayText[cursor] !== "[") throw new Error("Configuration records must be an array");
  cursor = skipJsonWhitespace(arrayText, cursor + 1);
  const values: Uint8Array[] = [];
  if (arrayText[cursor] === "]") return values;
  while (cursor < arrayText.length) {
    const valueEnd = scanJsonValueEnd(arrayText, cursor);
    values.push(textEncoder.encode(arrayText.slice(cursor, valueEnd)));
    cursor = skipJsonWhitespace(arrayText, valueEnd);
    if (arrayText[cursor] === "]") return values;
    if (arrayText[cursor] !== ",") throw new Error("Invalid configuration array separator");
    cursor = skipJsonWhitespace(arrayText, cursor + 1);
  }
  throw new Error("Unterminated configuration array");
};

const parseObjectValue = (
  text: string,
  slice: JsonPropertySlice | undefined,
): Record<string, unknown> => {
  if (!slice) return {};
  const value = JSON.parse(text.slice(slice.start, slice.end)) as unknown;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Configuration settings must be an object");
  }
  return value as Record<string, unknown>;
};

const createV2Snapshot = (
  document: ConfigDocumentV2,
  settingsBytes: Uint8Array,
  recordBytes: readonly Uint8Array[],
): ConfigDocumentV2 => {
  const value = document as V2DocumentWithSnapshot;
  Object.defineProperty(value, V2_DOCUMENT_SNAPSHOT, {
    configurable: false,
    enumerable: false,
    value: {
      selectedConfigurationId: document.selectedConfigurationId,
      settingsBytes: copyBytes(settingsBytes),
      recordBytes: recordBytes.map(copyBytes),
    } satisfies V2DocumentSnapshot,
    writable: false,
  });
  return value;
};

const byteArraysEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);

const recordBytesForDocument = (document: ConfigDocumentV2): Uint8Array[] =>
  document.configurations.map((record) => copyBytes(record.rawBytes));

const isSupportedV2Record = (
  record: DecodedProviderConfigurationRecord,
): record is Extract<DecodedProviderConfigurationRecord, { status: "supported" }> =>
  record.status === "supported";

const assertV2Document = (document: ConfigDocumentV2): void => {
  if (document.schemaVersion !== CONFIG_SCHEMA_VERSION_V2) {
    throw new Error("Configuration writer requires schemaVersion 2");
  }
  if (
    !document.settings ||
    typeof document.settings !== "object" ||
    Array.isArray(document.settings)
  ) {
    throw new Error("Configuration settings must be an object");
  }

  const ids = new Set<string>();
  for (const record of document.configurations) {
    const id = record.status === "unknown" ? record.configurationId : record.record.configurationId;
    if (id !== undefined) {
      if (ids.has(id)) throw new ProviderConfigurationConflictError("Duplicate configuration id");
      ids.add(id);
    }
    if (record.status === "supported")
      SupportedProviderConfigurationRecordSchema.parse(record.record);
    if (record.status === "removed") RemovedProviderConfigurationRecordSchema.parse(record.record);
    if (record.rawBytes.byteLength > MAX_V2_RECORD_BYTES) {
      throw new Error("Configuration record exceeds the size limit");
    }
  }
  if (document.selectedConfigurationId !== null) {
    const selected = document.configurations.find(
      (record) =>
        isSupportedV2Record(record) &&
        record.record.configurationId === document.selectedConfigurationId,
    );
    if (!selected) {
      throw new ProviderConfigurationConflictError("Selected configuration must be supported");
    }
  }
};

const serializeV2Record = (record: DecodedProviderConfigurationRecord): string => {
  const bytes = record.rawBytes;
  const text = decodeConfigText(bytes);
  if (record.status === "unknown") return text;

  try {
    const decoded = decodeProviderConfigurationRecord(bytes);
    if (
      decoded.status === record.status &&
      JSON.stringify(decoded.record) === JSON.stringify(record.record)
    ) {
      return text;
    }
  } catch {
    // A changed known record is serialized from its validated representation below.
  }
  return JSON.stringify(record.record);
};

/** Decode a schemaVersion=2 config file while retaining each record's exact bytes. */
export const decodeConfigV2 = (inputBytes: Uint8Array): ConfigDocumentV2 => {
  const bytes = copyBytes(inputBytes);
  if (bytes.byteLength > MAX_V2_CONFIG_BYTES) throw new Error("Configuration file is too large");
  const text = decodeConfigText(bytes);
  const properties = scanJsonObjectProperties(text);
  const schemaVersionSlice = properties.get("schemaVersion");
  if (!schemaVersionSlice) throw new Error("Configuration file has no schemaVersion");
  const schemaVersion = JSON.parse(
    text.slice(schemaVersionSlice.start, schemaVersionSlice.end),
  ) as unknown;
  if (schemaVersion !== CONFIG_SCHEMA_VERSION_V2) {
    throw new Error("Configuration file is not schemaVersion 2");
  }
  const recordsSlice = properties.get("configurations");
  if (!recordsSlice) throw new Error("Configuration file has no records");
  const selectedValue = properties.get("selectedConfigurationId");
  const selectedConfigurationId = selectedValue
    ? (JSON.parse(
        text.slice(selectedValue.start, selectedValue.end),
      ) as ConfigDocumentV2["selectedConfigurationId"])
    : null;
  const records = splitJsonArrayElements(text.slice(recordsSlice.start, recordsSlice.end)).map(
    decodeProviderConfigurationRecord,
  );
  const settingsSlice = properties.get("settings");
  const settingsBytes = settingsSlice
    ? textEncoder.encode(text.slice(settingsSlice.start, settingsSlice.end))
    : textEncoder.encode("{}");
  const document = {
    schemaVersion: CONFIG_SCHEMA_VERSION_V2,
    settings: parseObjectValue(text, settingsSlice),
    selectedConfigurationId,
    configurations: records,
    rawBytes: bytes,
    ...(settingsSlice ? { rawSettingsBytes: copyBytes(settingsBytes) } : {}),
  } satisfies ConfigDocumentV2;
  assertV2Document(document);
  return createV2Snapshot(
    document,
    settingsBytes,
    records.map((record) => record.rawBytes),
  );
};

const readSchemaVersion = (text: string): unknown => {
  const properties = scanJsonObjectProperties(text);
  const slice = properties.get("schemaVersion");
  return slice ? JSON.parse(text.slice(slice.start, slice.end)) : undefined;
};

/** Decode the V1 provider array; hasApiKey exists only in this migration result. */
export const decodeConfigV1 = (inputBytes: Uint8Array): ConfigDocumentV1 => {
  const bytes = copyBytes(inputBytes);
  if (bytes.byteLength > MAX_V2_CONFIG_BYTES) throw new Error("Configuration file is too large");
  const text = decodeConfigText(bytes);
  const properties = scanJsonObjectProperties(text);
  const schemaVersion = readSchemaVersion(text);
  if (schemaVersion !== undefined && schemaVersion !== 1) {
    throw new Error("Configuration file is not a V1 document");
  }
  const providersSlice = properties.get("providers");
  if (!providersSlice) throw new Error("V1 configuration file has no providers");
  const providers = splitJsonArrayElements(
    text.slice(providersSlice.start, providersSlice.end),
  ).map((recordBytes): V1ConfigurationRecord => {
    const decoded = decodeLegacyProviderConfigurationRecord(recordBytes);
    if (decoded.status === "migrate-v1") {
      return { status: "migrate-v1", record: decoded.record, rawBytes: copyBytes(recordBytes) };
    }
    if (decoded.status === "removed") {
      return { status: "removed", record: decoded.record, rawBytes: copyBytes(recordBytes) };
    }
    return { status: "unknown", rawBytes: copyBytes(recordBytes) };
  });
  const document = {
    schemaVersion: 1 as const,
    settings: parseObjectValue(text, properties.get("settings")),
    providers,
    rawBytes: bytes,
  } satisfies ConfigDocumentV1;
  return document;
};

/** Decode either supported persistence version without silently migrating V1. */
export const decodeConfigFile = (inputBytes: Uint8Array): ConfigDocumentV2 | ConfigDocumentV1 => {
  if (inputBytes.byteLength > MAX_V2_CONFIG_BYTES) {
    throw new Error("Configuration file is too large");
  }
  const text = decodeConfigText(inputBytes);
  return readSchemaVersion(text) === CONFIG_SCHEMA_VERSION_V2
    ? decodeConfigV2(inputBytes)
    : decodeConfigV1(inputBytes);
};

/** Serialize only schemaVersion=2; V1 records are never emitted by this writer. */
export const serializeConfigV2 = (document: ConfigDocumentV2): Uint8Array => {
  assertV2Document(document);
  const snapshot = (document as V2DocumentWithSnapshot)[V2_DOCUMENT_SNAPSHOT];
  const settingsBytes = textEncoder.encode(JSON.stringify(document.settings));
  const recordBytes = recordBytesForDocument(document);
  if (
    snapshot &&
    document.rawBytes &&
    snapshot.selectedConfigurationId === document.selectedConfigurationId &&
    byteArraysEqual(snapshot.settingsBytes, settingsBytes) &&
    snapshot.recordBytes.length === recordBytes.length &&
    snapshot.recordBytes.every((bytes, index) =>
      byteArraysEqual(bytes, recordBytes[index] ?? new Uint8Array()),
    )
  ) {
    return copyBytes(document.rawBytes);
  }
  const records = document.configurations.map(serializeV2Record).join(",");
  return textEncoder.encode(
    `{"schemaVersion":2,"settings":${new TextDecoder().decode(settingsBytes)},"selectedConfigurationId":${JSON.stringify(document.selectedConfigurationId)},"configurations":[${records}]}\n`,
  );
};

/** Atomically persist a validated V2 document under the existing config lock. */
export const persistConfigV2 = async (document: ConfigDocumentV2): Promise<void> => {
  const bytes = serializeConfigV2(document);
  await withFileTransactionLock(CONFIG_PATH(), () =>
    atomicWriteFile(CONFIG_PATH(), new TextDecoder().decode(bytes), 0o600),
  );
};

export const loadConfigV2 = (): ConfigDocumentV2 => {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(CONFIG_PATH()));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {
        schemaVersion: CONFIG_SCHEMA_VERSION_V2,
        settings: {},
        selectedConfigurationId: null,
        configurations: [],
      };
    }
    throw error;
  }
  const decoded = decodeConfigV2(bytes);
  return decoded;
};

/** Select a supported configuration without changing any record bytes or order. */
export const selectConfigV2 = (
  document: ConfigDocumentV2,
  configurationId: ConfigDocumentV2["selectedConfigurationId"],
): ConfigDocumentV2 => {
  const next = { ...document, selectedConfigurationId: configurationId };
  assertV2Document(next);
  return next;
};

/** Replace one record only after matching its configuration identity and revision. */
export const replaceConfigV2Record = (
  document: ConfigDocumentV2,
  expected: { configurationId: string; revision: number },
  replacement: DecodedProviderConfigurationRecord,
): ConfigDocumentV2 => {
  if (replacement.status === "unknown")
    throw new ProviderConfigurationConflictError("Unknown replacement");
  if (replacement.record.configurationId !== expected.configurationId) {
    throw new ProviderConfigurationConflictError("Configuration id conflict");
  }
  if (replacement.record.revision !== expected.revision) {
    throw new ProviderConfigurationConflictError("Configuration revision conflict");
  }
  const index = document.configurations.findIndex(
    (record) =>
      record.status !== "unknown" && record.record.configurationId === expected.configurationId,
  );
  const current = document.configurations[index];
  if (!current || current.status === "unknown" || current.record.revision !== expected.revision) {
    throw new ProviderConfigurationConflictError("Configuration revision conflict");
  }
  const configurations = [...document.configurations];
  configurations[index] = replacement;
  const next = { ...document, configurations };
  assertV2Document(next);
  return next;
};
