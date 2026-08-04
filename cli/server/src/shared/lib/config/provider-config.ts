import { TextDecoder, TextEncoder } from "node:util";
import { scanJsonRejectingDuplicateKeys } from "@diffgazer/core/json";
import {
  type ConfigurationId,
  ConfigurationIdSchema,
  type ConfigurationRevision,
  ConfigurationRevisionSchema,
  type ExactModelId,
  ExactModelIdSchema,
  HostedApiConfigurationInputSchema,
  LocalCliConfigurationInputSchema,
  LocalHttpConfigurationInputSchema,
  REMOVED_PRODUCT_IDS,
} from "@diffgazer/core/schemas/config";
import { z } from "zod";

/** The on-disk configuration format owned by the server. */
export const PROVIDER_CONFIGURATION_SCHEMA_VERSION = 2 as const;

const TimestampSchema = z.iso.datetime();
const RunnableProductIdSchema = z.enum([
  "gemini",
  "zai",
  "openrouter",
  "groq",
  "cerebras",
  "deepseek",
  "qwen",
  "moonshot",
  "mistral",
  "ollama",
  "local-openai",
  "codex-cli",
  "copilot-cli",
]);

/**
 * The transport input persisted in config.json.  These schemas deliberately do
 * not contain `credential` or `bearerToken`: those are write-only inputs owned by
 * secret-bindings.ts and must never be part of a non-secret record.
 */
export const NonSecretTransportInputSchema = z.discriminatedUnion("transportFamily", [
  z
    .strictObject({
      transportFamily: HostedApiConfigurationInputSchema.shape.transportFamily,
      productId: HostedApiConfigurationInputSchema.shape.productId,
      endpoint: HostedApiConfigurationInputSchema.shape.endpoint,
      region: HostedApiConfigurationInputSchema.shape.region,
      workspace: HostedApiConfigurationInputSchema.shape.workspace,
    })
    .superRefine((input, context) => {
      const result = HostedApiConfigurationInputSchema.safeParse(input);
      if (!result.success) {
        for (const issue of result.error.issues) {
          context.addIssue({ code: "custom", path: issue.path, message: issue.message });
        }
      }
    }),
  z
    .strictObject({
      transportFamily: LocalHttpConfigurationInputSchema.shape.transportFamily,
      productId: LocalHttpConfigurationInputSchema.shape.productId,
      endpoint: LocalHttpConfigurationInputSchema.shape.endpoint,
      authentication: LocalHttpConfigurationInputSchema.shape.authentication,
      presetId: LocalHttpConfigurationInputSchema.shape.presetId,
    })
    .superRefine((input, context) => {
      const result = LocalHttpConfigurationInputSchema.safeParse(input);
      if (!result.success) {
        for (const issue of result.error.issues) {
          context.addIssue({ code: "custom", path: issue.path, message: issue.message });
        }
      }
    }),
  LocalCliConfigurationInputSchema,
]);
export type NonSecretTransportInput = z.infer<typeof NonSecretTransportInputSchema>;

export const ConfigurationAcknowledgementSchema = z.strictObject({
  noticeVersion: z.number().int().positive(),
  acceptedAt: TimestampSchema.nullable(),
});

/** Evidence is a non-secret identity/reference.  The evidence payload stays server-side. */
export const ConfigurationEvidenceReferenceSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);

const BudgetLimitSchema = z.number().int().positive().max(2_147_483_647);
export const ConfigurationBudgetLimitsSchema = z.strictObject({
  inputTokens: BudgetLimitSchema,
  outputTokens: BudgetLimitSchema,
  responseBytes: BudgetLimitSchema,
  wallTimeMs: BudgetLimitSchema,
  retries: z.number().int().nonnegative().max(100),
  concurrency: BudgetLimitSchema,
  perReview: BudgetLimitSchema,
});
export type ConfigurationBudgetLimits = z.infer<typeof ConfigurationBudgetLimitsSchema>;

const ProviderConfigurationRecordBaseShape = {
  schemaVersion: z.literal(PROVIDER_CONFIGURATION_SCHEMA_VERSION),
  configurationId: ConfigurationIdSchema,
  revision: ConfigurationRevisionSchema,
  transportFamily: z.enum(["hosted-api", "local-http", "local-cli"]),
  productId: RunnableProductIdSchema,
  input: NonSecretTransportInputSchema,
  selectedModelId: ExactModelIdSchema.nullable(),
  acknowledgement: ConfigurationAcknowledgementSchema,
  evidenceReference: ConfigurationEvidenceReferenceSchema.nullable(),
  budget: ConfigurationBudgetLimitsSchema,
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
} as const;

/** A supported, executable-candidate record without any secret material. */
export const SupportedProviderConfigurationRecordSchema = z
  .strictObject({
    ...ProviderConfigurationRecordBaseShape,
    status: z.literal("supported"),
  })
  .superRefine((record, context) => {
    if (record.transportFamily !== record.input.transportFamily) {
      context.addIssue({
        code: "custom",
        path: ["transportFamily"],
        message: "Transport family must match the family input",
      });
    }
    if (record.productId !== record.input.productId) {
      context.addIssue({
        code: "custom",
        path: ["productId"],
        message: "Product id must match the family input",
      });
    }
  });
export type SupportedProviderConfigurationRecord = z.infer<
  typeof SupportedProviderConfigurationRecordSchema
>;

/** A known removed record. It is retained for migration/deletion only. */
export const RemovedProviderConfigurationRecordSchema = z.strictObject({
  schemaVersion: z.literal(PROVIDER_CONFIGURATION_SCHEMA_VERSION),
  status: z.literal("removed"),
  configurationId: ConfigurationIdSchema,
  revision: ConfigurationRevisionSchema,
  productId: z.literal(REMOVED_PRODUCT_IDS[0]),
  transportFamily: z.literal("hosted-api"),
  selectedModelId: z.null(),
  acknowledgement: ConfigurationAcknowledgementSchema.nullable(),
  evidenceReference: ConfigurationEvidenceReferenceSchema.nullable(),
  budget: ConfigurationBudgetLimitsSchema.nullable(),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema,
});
export type RemovedProviderConfigurationRecord = z.infer<
  typeof RemovedProviderConfigurationRecordSchema
>;

export type UnknownProviderConfigurationRecord = {
  readonly status: "unknown";
  readonly rawBytes: Uint8Array;
  /** A non-authoritative id is useful for diagnostics, but never for selection. */
  readonly configurationId?: ConfigurationId;
};

export type ProviderConfigurationRecord =
  | SupportedProviderConfigurationRecord
  | RemovedProviderConfigurationRecord
  | UnknownProviderConfigurationRecord;

export type DecodedProviderConfigurationRecord =
  | {
      readonly status: "supported";
      readonly record: SupportedProviderConfigurationRecord;
      readonly rawBytes: Uint8Array;
    }
  | {
      readonly status: "removed";
      readonly record: RemovedProviderConfigurationRecord;
      readonly rawBytes: Uint8Array;
    }
  | UnknownProviderConfigurationRecord;

export type ProviderConfigurationFileRecord =
  | { readonly status: "supported"; readonly record: SupportedProviderConfigurationRecord }
  | { readonly status: "removed"; readonly record: RemovedProviderConfigurationRecord }
  | UnknownProviderConfigurationRecord;

export interface ProviderConfigurationFile {
  readonly schemaVersion: typeof PROVIDER_CONFIGURATION_SCHEMA_VERSION;
  readonly selectedConfigurationId: ConfigurationId | null;
  readonly records: readonly ProviderConfigurationFileRecord[];
}

export class ProviderConfigurationConflictError extends Error {
  readonly code = "CONFIGURATION_CONFLICT" as const;

  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigurationConflictError";
  }
}

export class ProviderConfigurationDecodeError extends Error {
  readonly code = "CONFIGURATION_DECODE_FAILED" as const;

  constructor(message: string) {
    super(message);
    this.name = "ProviderConfigurationDecodeError";
  }
}

function copyBytes(rawBytes: Uint8Array): Uint8Array {
  return new Uint8Array(rawBytes);
}

function decodeUtf8(rawBytes: Uint8Array): string | null {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(rawBytes);
  } catch {
    return null;
  }
}

const MAX_PROVIDER_CONFIGURATION_RECORD_BYTES = 256 * 1024;
const MAX_PROVIDER_CONFIGURATION_FILE_BYTES = 2 * 1024 * 1024;
const MAX_JSON_DEPTH = 64;

/**
 * Decode one bounded provider-configuration document. The shared scanner rejects
 * a repeated object key, which `JSON.parse` alone would collapse to the last
 * value — letting a crafted file relabel a removed record as a supported one.
 */
function parseProviderConfigurationJson(text: string, maxBytes: number): unknown {
  scanJsonRejectingDuplicateKeys(text, {
    maxBytes,
    maxDepth: MAX_JSON_DEPTH,
    onFail: ({ position, reason }) => {
      throw new ProviderConfigurationDecodeError(
        `Invalid provider configuration JSON at ${position}: ${reason}`,
      );
    },
  });
  return JSON.parse(text) as unknown;
}

function parseKnownRecord(
  input: unknown,
):
  | { readonly status: "supported"; readonly record: SupportedProviderConfigurationRecord }
  | { readonly status: "removed"; readonly record: RemovedProviderConfigurationRecord }
  | null {
  const supported = SupportedProviderConfigurationRecordSchema.safeParse(input);
  if (supported.success) return { status: "supported", record: supported.data };
  const removed = RemovedProviderConfigurationRecordSchema.safeParse(input);
  if (removed.success) return { status: "removed", record: removed.data };
  return null;
}

function parseRemovedLegacyRecord(input: unknown): RemovedProviderConfigurationRecord | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const record = input as Record<string, unknown>;
  if (record.provider !== REMOVED_PRODUCT_IDS[0] || typeof record.configurationId !== "string")
    return null;
  const now = new Date(0).toISOString();
  const revision =
    typeof record.revision === "number" && Number.isInteger(record.revision) && record.revision > 0
      ? record.revision
      : 1;
  const parsedId = ConfigurationIdSchema.safeParse(record.configurationId);
  if (!parsedId.success) return null;
  return {
    schemaVersion: PROVIDER_CONFIGURATION_SCHEMA_VERSION,
    status: "removed",
    configurationId: parsedId.data,
    revision,
    productId: REMOVED_PRODUCT_IDS[0],
    transportFamily: "hosted-api",
    selectedModelId: null,
    acknowledgement: null,
    evidenceReference: null,
    budget: null,
    createdAt: now,
    updatedAt: now,
  };
}

/** Decode one record, retaining the exact bytes for unknown/future records. */
export function decodeProviderConfigurationRecord(
  inputBytes: Uint8Array,
): DecodedProviderConfigurationRecord {
  const rawBytes = copyBytes(inputBytes);
  if (rawBytes.byteLength > MAX_PROVIDER_CONFIGURATION_RECORD_BYTES) {
    return { status: "unknown", rawBytes };
  }
  const text = decodeUtf8(rawBytes);
  if (text === null) return { status: "unknown", rawBytes };

  let input: unknown;
  try {
    input = parseProviderConfigurationJson(text, MAX_PROVIDER_CONFIGURATION_RECORD_BYTES);
  } catch {
    return { status: "unknown", rawBytes };
  }
  const known = parseKnownRecord(input);
  if (known) return { ...known, rawBytes };

  const removedLegacy = parseRemovedLegacyRecord(input);
  if (removedLegacy) return { status: "removed", record: removedLegacy, rawBytes };

  const configurationId =
    input && typeof input === "object" && !Array.isArray(input)
      ? ConfigurationIdSchema.safeParse((input as Record<string, unknown>).configurationId)
      : null;
  return {
    status: "unknown",
    rawBytes,
    ...(configurationId?.success ? { configurationId: configurationId.data } : {}),
  };
}

function findMatchingArrayEnd(text: string, key: string): { start: number; end: number } | null {
  const keyIndex = text.indexOf(`"${key}"`);
  if (keyIndex < 0) return null;
  const colonIndex = text.indexOf(":", keyIndex + key.length + 2);
  if (colonIndex < 0) return null;
  let cursor = colonIndex + 1;
  while (cursor < text.length && " \t\n\r".includes(text[cursor] ?? "")) cursor += 1;
  if (text[cursor] !== "[") return null;
  const start = cursor;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (; cursor < text.length; cursor += 1) {
    const character = text[cursor];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "[") depth += 1;
    if (character === "]") {
      depth -= 1;
      if (depth === 0) return { start, end: cursor + 1 };
    }
  }
  return null;
}

function splitArrayElements(arrayText: string): Uint8Array[] {
  const text = arrayText.trim();
  if (!text.startsWith("[") || !text.endsWith("]"))
    throw new ProviderConfigurationDecodeError("Configuration records must be an array");
  const values: Uint8Array[] = [];
  let elementStart = 1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  const pushElement = (end: number): void => {
    const value = text.slice(elementStart, end).trim();
    if (value.length > 0) values.push(new TextEncoder().encode(value));
  };
  for (let cursor = 1; cursor < text.length - 1; cursor += 1) {
    const character = text[cursor];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{" || character === "[") depth += 1;
    else if (character === "}" || character === "]") depth -= 1;
    else if (character === "," && depth === 0) {
      pushElement(cursor);
      elementStart = cursor + 1;
    }
  }
  pushElement(text.length - 1);
  return values;
}

function recordsFromDecoded(
  decoded: DecodedProviderConfigurationRecord[],
): ProviderConfigurationFileRecord[] {
  return decoded.map((item): ProviderConfigurationFileRecord => {
    switch (item.status) {
      case "unknown":
        return item;
      case "supported":
        return { status: "supported", record: item.record };
      case "removed":
        return { status: "removed", record: item.record };
      default:
        throw new ProviderConfigurationDecodeError("Unknown provider configuration status");
    }
  });
}

function readSelectedConfigurationId(input: unknown): ConfigurationId | null {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ProviderConfigurationDecodeError("Configuration file root must be an object");
  }
  const selected = (input as Record<string, unknown>).selectedConfigurationId;
  if (selected === null || selected === undefined) return null;
  const parsed = ConfigurationIdSchema.safeParse(selected);
  if (!parsed.success)
    throw new ProviderConfigurationDecodeError("Invalid selected configuration id");
  return parsed.data;
}

/** Decode config.json while retaining opaque record bytes and their array order. */
export function decodeProviderConfigurationFile(inputBytes: Uint8Array): ProviderConfigurationFile {
  const rawBytes = copyBytes(inputBytes);
  if (rawBytes.byteLength > MAX_PROVIDER_CONFIGURATION_FILE_BYTES) {
    throw new ProviderConfigurationDecodeError(
      "Provider configuration file exceeds the size limit",
    );
  }
  const text = decodeUtf8(rawBytes);
  if (text === null)
    throw new ProviderConfigurationDecodeError("Provider configuration file is not UTF-8");
  const parsed = parseProviderConfigurationJson(text, MAX_PROVIDER_CONFIGURATION_FILE_BYTES);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new ProviderConfigurationDecodeError("Configuration file root must be an object");
  }
  const root = parsed as Record<string, unknown>;
  if (root.schemaVersion !== PROVIDER_CONFIGURATION_SCHEMA_VERSION) {
    throw new ProviderConfigurationDecodeError("Unsupported provider configuration schema version");
  }
  const array = findMatchingArrayEnd(text, "configurations");
  if (!array) throw new ProviderConfigurationDecodeError("Configuration file has no records array");
  const values = splitArrayElements(text.slice(array.start, array.end));
  const decoded = values.map(decodeProviderConfigurationRecord);
  const file: ProviderConfigurationFile = {
    schemaVersion: PROVIDER_CONFIGURATION_SCHEMA_VERSION,
    selectedConfigurationId: readSelectedConfigurationId(root),
    records: recordsFromDecoded(decoded),
  };
  assertProviderConfigurationFile(file);
  return file;
}

function serializeRecord(record: ProviderConfigurationFileRecord): string {
  if (record.status === "unknown") return new TextDecoder().decode(record.rawBytes);
  return JSON.stringify(record.record);
}

/** Serialize a V2 file, preserving opaque record bytes and record order. */
export function encodeProviderConfigurationFile(file: ProviderConfigurationFile): Uint8Array {
  assertProviderConfigurationFile(file);
  const records = file.records.map(serializeRecord).join(",");
  return new TextEncoder().encode(
    `{"schemaVersion":${PROVIDER_CONFIGURATION_SCHEMA_VERSION},"selectedConfigurationId":${JSON.stringify(file.selectedConfigurationId)},"configurations":[${records}]}\n`,
  );
}

/** Validate duplicate ids and ensure selected state never points at removed/unknown data. */
export function assertProviderConfigurationFile(file: ProviderConfigurationFile): void {
  const ids = new Set<string>();
  for (const item of file.records) {
    const id = item.status === "unknown" ? item.configurationId : item.record.configurationId;
    if (id !== undefined) {
      if (ids.has(id))
        throw new ProviderConfigurationConflictError(`Duplicate configuration id: ${id}`);
      ids.add(id);
    }
    if (item.status === "supported") {
      SupportedProviderConfigurationRecordSchema.parse(item.record);
    } else if (item.status === "removed") {
      RemovedProviderConfigurationRecordSchema.parse(item.record);
    }
  }
  if (file.selectedConfigurationId !== null) {
    const selected = file.records.find(
      (item) =>
        item.status === "supported" && item.record.configurationId === file.selectedConfigurationId,
    );
    if (!selected) {
      throw new ProviderConfigurationConflictError(
        "Selected configuration must identify a supported configuration",
      );
    }
  }
}

export function assertConfigurationIdentity(
  record: Pick<
    SupportedProviderConfigurationRecord | RemovedProviderConfigurationRecord,
    "configurationId"
  >,
  configurationId: ConfigurationId,
): void {
  if (record.configurationId !== configurationId) {
    throw new ProviderConfigurationConflictError("Configuration id conflict");
  }
}

export function assertExpectedRevision(
  record: Pick<
    SupportedProviderConfigurationRecord | RemovedProviderConfigurationRecord,
    "revision"
  >,
  expectedRevision: ConfigurationRevision,
): void {
  if (record.revision !== expectedRevision) {
    throw new ProviderConfigurationConflictError("Configuration revision conflict");
  }
}

export function selectProviderConfiguration(
  file: ProviderConfigurationFile,
  configurationId: ConfigurationId | null,
): ProviderConfigurationFile {
  if (configurationId !== null) {
    const selected = file.records.find(
      (item) => item.status === "supported" && item.record.configurationId === configurationId,
    );
    if (!selected)
      throw new ProviderConfigurationConflictError(
        "Cannot select a removed or unknown configuration",
      );
  }
  const next = { ...file, selectedConfigurationId: configurationId };
  assertProviderConfigurationFile(next);
  return next;
}

/** Replace one supported record only when both id and expected revision match. */
export function replaceProviderConfiguration(
  file: ProviderConfigurationFile,
  expected: { configurationId: ConfigurationId; revision: ConfigurationRevision },
  replacement: SupportedProviderConfigurationRecord | RemovedProviderConfigurationRecord,
): ProviderConfigurationFile {
  assertConfigurationIdentity(replacement, expected.configurationId);
  assertExpectedRevision(replacement, expected.revision);
  const index = file.records.findIndex(
    (item) => item.status !== "unknown" && item.record.configurationId === expected.configurationId,
  );
  if (index < 0) throw new ProviderConfigurationConflictError("Configuration id conflict");
  const current = file.records[index];
  if (!current || current.status === "unknown")
    throw new ProviderConfigurationConflictError("Configuration id conflict");
  assertExpectedRevision(current.record, expected.revision);
  const records = [...file.records];
  records[index] =
    replacement.status === "supported"
      ? { status: "supported", record: replacement }
      : { status: "removed", record: replacement };
  const next = { ...file, records };
  assertProviderConfigurationFile(next);
  return next;
}

export type { ConfigurationId, ConfigurationRevision, ExactModelId };
