import { scanJsonRejectingDuplicateKeys } from "@diffgazer/core/json";
import { decodeLegacyProviderConfigurationRecord } from "@diffgazer/core/schemas/config";
import {
  type DecodedProviderConfigurationRecord,
  decodeProviderConfigurationRecord,
  ProviderConfigurationConflictError,
  SupportedProviderConfigurationRecordSchema,
} from "../provider-config.js";
import {
  CONFIG_SCHEMA_VERSION_V2,
  type ConfigDocumentV1,
  type ConfigDocumentV2,
  V1_MIGRATION_FAILED_MESSAGE,
  type V1ConfigurationRecord,
} from "../types.js";
import {
  type JsonPropertySlice,
  scanJsonObjectProperties,
  scanJsonObjectPropertiesWithObserver,
  splitJsonArrayElements,
} from "./json-slices.js";

export { parseSettingsRecord } from "@diffgazer/core/schemas/config";

const MAX_V2_CONFIG_BYTES = 2 * 1024 * 1024;
const MAX_V2_RECORD_BYTES = 256 * 1024;
const MAX_CONFIG_JSON_DEPTH = 64;
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
  }
  if (document.selectedConfigurationId !== null) {
    // The selection may name an unknown record — a retired product's bytes stay
    // addressable so the user can inspect or remove it — but never a record the
    // document does not carry at all.
    const selected = document.configurations.find((record) => {
      const id = isSupportedV2Record(record)
        ? record.record.configurationId
        : record.configurationId;
      return id === document.selectedConfigurationId;
    });
    if (!selected) {
      throw new ProviderConfigurationConflictError("Selected configuration must exist");
    }
  }
};

const serializeV2Record = (record: DecodedProviderConfigurationRecord): string => {
  const bytes = record.rawBytes;
  const text = decodeConfigText(bytes);
  if (record.status === "unknown") return text;

  const decoded = decodeProviderConfigurationRecord(bytes);
  if (
    decoded.status === record.status &&
    JSON.stringify(decoded.record) === JSON.stringify(record.record)
  ) {
    return text;
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
  } satisfies ConfigDocumentV2;
  assertV2Document(document);
  return createV2Snapshot(
    document,
    settingsBytes,
    records.map((record) => record.rawBytes),
  );
};

const hasUniqueRootV2Version = (text: string): boolean => {
  let hasDuplicateSchemaVersion = false;
  let schemaVersion: unknown;
  try {
    scanJsonObjectPropertiesWithObserver(text, {
      continueAfterDuplicate: true,
      onDuplicate: (key) => {
        if (key === "schemaVersion") hasDuplicateSchemaVersion = true;
      },
      onProperty: (key, slice) => {
        if (key === "schemaVersion") {
          schemaVersion = JSON.parse(text.slice(slice.start, slice.end)) as unknown;
        }
      },
    });
  } catch {
    // A version parsed before later malformed content still identifies the document.
  }
  return !hasDuplicateSchemaVersion && schemaVersion === CONFIG_SCHEMA_VERSION_V2;
};

/** Decode the V1 provider array; hasApiKey exists only in this migration result. */
export const decodeConfigV1 = (inputBytes: Uint8Array): ConfigDocumentV1 => {
  try {
    const bytes = copyBytes(inputBytes);
    if (bytes.byteLength > MAX_V2_CONFIG_BYTES) throw new Error();
    const text = decodeConfigText(bytes);
    scanJsonRejectingDuplicateKeys(text, {
      maxBytes: MAX_V2_CONFIG_BYTES,
      maxDepth: MAX_CONFIG_JSON_DEPTH,
      onFail: () => {
        throw new Error();
      },
    });
    const properties = scanJsonObjectProperties(text);
    const supportedProperties = new Set(["schemaVersion", "settings", "providers"]);
    if ([...properties.keys()].some((key) => !supportedProperties.has(key))) throw new Error();
    const schemaVersionSlice = properties.get("schemaVersion");
    const schemaVersion = schemaVersionSlice
      ? (JSON.parse(text.slice(schemaVersionSlice.start, schemaVersionSlice.end)) as unknown)
      : undefined;
    if (schemaVersion !== undefined && schemaVersion !== 1) throw new Error();
    const providersSlice = properties.get("providers");
    // A settings-only V1 file is valid: the provider array was optional.
    const providerElements = providersSlice
      ? splitJsonArrayElements(text.slice(providersSlice.start, providersSlice.end))
      : [];
    const providers = providerElements.map((recordBytes): V1ConfigurationRecord => {
      const decoded = decodeLegacyProviderConfigurationRecord(recordBytes);
      if (decoded.status === "migrate-v1") {
        return {
          status: "migrate-v1",
          record: decoded.record,
          rawBytes: copyBytes(recordBytes),
        };
      }
      return { status: "unknown", rawBytes: copyBytes(recordBytes) };
    });
    if (providers.some((record) => record.status === "unknown")) throw new Error();
    return {
      schemaVersion: 1 as const,
      settings: parseObjectValue(text, properties.get("settings")),
      providers,
      rawBytes: bytes,
    } satisfies ConfigDocumentV1;
  } catch {
    throw new Error(V1_MIGRATION_FAILED_MESSAGE);
  }
};

export const isV1ConfigMigrationFailure = (cause: unknown): boolean =>
  cause instanceof Error && cause.message === V1_MIGRATION_FAILED_MESSAGE;

/** Decode either supported persistence version without silently migrating V1. */
export const decodeConfigFile = (inputBytes: Uint8Array): ConfigDocumentV2 | ConfigDocumentV1 => {
  if (inputBytes.byteLength > MAX_V2_CONFIG_BYTES)
    throw new Error("Configuration file is too large");
  const text = decodeConfigText(inputBytes);
  let parsed: unknown;
  try {
    scanJsonRejectingDuplicateKeys(text, {
      maxBytes: MAX_V2_CONFIG_BYTES,
      maxDepth: MAX_CONFIG_JSON_DEPTH,
      onFail: () => {
        throw new Error();
      },
    });
    parsed = JSON.parse(text);
  } catch {
    throw new Error(
      hasUniqueRootV2Version(text)
        ? "Configuration file contains invalid JSON"
        : V1_MIGRATION_FAILED_MESSAGE,
    );
  }
  const schemaVersion =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).schemaVersion
      : undefined;
  return schemaVersion === CONFIG_SCHEMA_VERSION_V2
    ? decodeConfigV2(inputBytes)
    : decodeConfigV1(inputBytes);
};

/** Serialize only schemaVersion=2; V1 records are never emitted by this writer. */
export const serializeConfigV2 = (document: ConfigDocumentV2): Uint8Array => {
  assertV2Document(document);
  for (const record of document.configurations) {
    if (record.rawBytes.byteLength > MAX_V2_RECORD_BYTES) {
      throw new Error("Configuration record exceeds the size limit");
    }
  }
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

/** Select a supported configuration without changing any record bytes or order. */
export const selectConfigV2 = (
  document: ConfigDocumentV2,
  configurationId: ConfigDocumentV2["selectedConfigurationId"],
): ConfigDocumentV2 => {
  // Decoding tolerates a selection left pointing at a record this build cannot
  // describe, but a new selection must name a record it can.
  if (
    configurationId !== null &&
    !document.configurations.some(
      (record) => isSupportedV2Record(record) && record.record.configurationId === configurationId,
    )
  ) {
    throw new ProviderConfigurationConflictError("Selected configuration must be supported");
  }
  const next = { ...document, selectedConfigurationId: configurationId };
  assertV2Document(next);
  return next;
};
