import { isDeepStrictEqual } from "node:util";
import { scanJsonRejectingDuplicateKeys } from "@diffgazer/core/json";
import { z } from "zod";
import { type SecretBinding, SecretBindingSchema } from "../secret-bindings.js";
import { type SecretsState, V1_MIGRATION_FAILED_MESSAGE } from "../types.js";
import { scanJsonObjectProperties, splitJsonArrayElements } from "./json-slices.js";

export const SECRETS_SCHEMA_VERSION_V2 = 2 as const;

export type DecodedSecretBinding =
  | {
      readonly status: "supported" | "removed";
      readonly binding: SecretBinding;
      readonly rawBytes: Uint8Array;
    }
  | {
      readonly status: "unknown";
      readonly binding?: SecretBinding;
      readonly rawBytes: Uint8Array;
    };

export interface SecretsDocumentV2 {
  readonly schemaVersion: typeof SECRETS_SCHEMA_VERSION_V2;
  readonly bindings: readonly DecodedSecretBinding[];
  readonly rawBytes?: Uint8Array;
}

/**
 * The persisted binding for one configuration identity. Identity is
 * `configurationId` + `revision`: re-binding a configuration bumps its revision,
 * so an entry from an earlier revision must never answer for the current record.
 * Document loading and snapshot timing stay with the caller.
 */
export function findSecretBinding(
  document: SecretsDocumentV2,
  configurationId: string,
  revision: number,
): SecretBinding | null {
  for (const entry of document.bindings) {
    const binding = entry.binding;
    if (
      binding?.status === "active" &&
      binding.configurationId === configurationId &&
      binding.revision === revision
    ) {
      return binding;
    }
  }
  return null;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const MAX_SECRETS_BYTES = 2 * 1024 * 1024;
const MAX_BINDING_BYTES = 256 * 1024;
const MAX_SECRETS_JSON_DEPTH = 64;
const INVALID_SECRETS_JSON_MESSAGE = "Secrets file contains invalid JSON";
const INVALID_SECRET_BINDING_MESSAGE = "Secret binding is invalid";
const V2_SECRETS_SNAPSHOT = Symbol("v2SecretsSnapshot");

interface V2SecretsSnapshotEntry {
  readonly status: DecodedSecretBinding["status"];
  readonly bindingJson: string | null;
  readonly rawBytes: Uint8Array;
}

type SecretsDocumentWithSnapshot = SecretsDocumentV2 & {
  readonly [V2_SECRETS_SNAPSHOT]?: readonly V2SecretsSnapshotEntry[];
};

const LEGACY_PROVIDER_ENV_VARS = {
  gemini: "GOOGLE_API_KEY",
  zai: "ZAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
} as const;
type AIProvider = keyof typeof LEGACY_PROVIDER_ENV_VARS;

const copyBytes = (bytes: Uint8Array): Uint8Array => new Uint8Array(bytes);

const decodeText = (bytes: Uint8Array): string => {
  try {
    return textDecoder.decode(bytes);
  } catch {
    throw new Error("Secrets file must be valid UTF-8");
  }
};

const parseSecretsJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(INVALID_SECRETS_JSON_MESSAGE);
  }
};

// safeParse reads the candidate's own properties, so a hostile in-memory binding
// with a throwing getter escapes it. The catch keeps every failure on the one
// fixed message, which cannot carry credential text out of that throw.
const parseSecretBinding = (value: unknown): SecretBinding => {
  try {
    const parsed = SecretBindingSchema.safeParse(value);
    if (!parsed.success) throw new Error(INVALID_SECRET_BINDING_MESSAGE);
    return parsed.data;
  } catch {
    throw new Error(INVALID_SECRET_BINDING_MESSAGE);
  }
};

const splitBindingBytes = (text: string): Uint8Array[] => {
  try {
    scanJsonRejectingDuplicateKeys(text, {
      maxBytes: MAX_SECRETS_BYTES,
      maxDepth: MAX_SECRETS_JSON_DEPTH,
      onFail: () => {
        throw new Error();
      },
    });
    const properties = scanJsonObjectProperties(text);
    const schemaVersion = properties.get("schemaVersion");
    const bindings = properties.get("bindings");
    if (
      !schemaVersion ||
      parseSecretsJson(text.slice(schemaVersion.start, schemaVersion.end)) !==
        SECRETS_SCHEMA_VERSION_V2 ||
      !bindings
    ) {
      throw new Error();
    }
    return splitJsonArrayElements(text.slice(bindings.start, bindings.end));
  } catch {
    throw new Error(INVALID_SECRETS_JSON_MESSAGE);
  }
};

const snapshotEntry = (entry: DecodedSecretBinding): V2SecretsSnapshotEntry => ({
  status: entry.status,
  bindingJson: entry.binding ? JSON.stringify(entry.binding) : null,
  rawBytes: copyBytes(entry.rawBytes),
});

const attachSnapshot = (document: SecretsDocumentV2): SecretsDocumentV2 => {
  Object.defineProperty(document, V2_SECRETS_SNAPSHOT, {
    configurable: false,
    enumerable: false,
    value: document.bindings.map(snapshotEntry),
    writable: false,
  });
  return document;
};

const byteArraysEqual = (left: Uint8Array, right: Uint8Array): boolean =>
  left.byteLength === right.byteLength && left.every((value, index) => value === right[index]);

const matchesSnapshot = (document: SecretsDocumentWithSnapshot): boolean => {
  const snapshot = document[V2_SECRETS_SNAPSHOT];
  if (!snapshot || snapshot.length !== document.bindings.length) return false;
  return document.bindings.every((entry, index) => {
    const original = snapshot[index];
    return (
      original !== undefined &&
      original.status === entry.status &&
      original.bindingJson === (entry.binding ? JSON.stringify(entry.binding) : null) &&
      byteArraysEqual(original.rawBytes, entry.rawBytes)
    );
  });
};

const decodeSecretBinding = (rawBytes: Uint8Array): DecodedSecretBinding => {
  if (rawBytes.byteLength > MAX_BINDING_BYTES) {
    throw new Error("Secret binding exceeds the size limit");
  }
  try {
    const binding = parseSecretBinding(parseSecretsJson(decodeText(rawBytes)));
    if (binding.status === "active") {
      return { status: "supported", binding, rawBytes: copyBytes(rawBytes) };
    }
    return {
      status: binding.status,
      binding,
      rawBytes: copyBytes(rawBytes),
    };
  } catch {
    return { status: "unknown", rawBytes: copyBytes(rawBytes) };
  }
};

const assertSecretsDocumentV2 = (document: SecretsDocumentV2): void => {
  if (document.schemaVersion !== SECRETS_SCHEMA_VERSION_V2) {
    throw new Error("Secrets writer requires schemaVersion 2");
  }
  const identityStatuses = new Map<string, Set<SecretBinding["status"]>>();
  for (const record of document.bindings) {
    if (record.rawBytes.byteLength > MAX_BINDING_BYTES) {
      throw new Error("Secret binding exceeds the size limit");
    }
    if (!record.binding) continue;
    const binding = parseSecretBinding(record.binding);
    const key = `${binding.configurationId}\u0000${binding.revision}`;
    const statuses = identityStatuses.get(key);
    if (!statuses) {
      identityStatuses.set(key, new Set([binding.status]));
    } else {
      const isAllowedPair =
        statuses.size === 1 &&
        ((statuses.has("active") && binding.status === "removed") ||
          (statuses.has("removed") && binding.status === "active"));
      if (!isAllowedPair) throw new Error("Duplicate secret binding identity");
      statuses.add(binding.status);
    }
    const expectedStatus = binding.status === "active" ? "supported" : binding.status;
    if (record.status !== expectedStatus) throw new Error("Secret binding status mismatch");
  }
};

export const decodeSecretsV2 = (inputBytes: Uint8Array): SecretsDocumentV2 => {
  const bytes = copyBytes(inputBytes);
  if (bytes.byteLength > MAX_SECRETS_BYTES) throw new Error("Secrets file is too large");
  const bindings = splitBindingBytes(decodeText(bytes)).map(decodeSecretBinding);
  const document = {
    schemaVersion: SECRETS_SCHEMA_VERSION_V2,
    bindings,
    rawBytes: bytes,
  } satisfies SecretsDocumentV2;
  assertSecretsDocumentV2(document);
  return attachSnapshot(document);
};

const serializeBinding = (record: DecodedSecretBinding): string => {
  if (!record.binding) return decodeText(record.rawBytes);
  const parsed = parseSecretBinding(record.binding);
  try {
    const original = parseSecretBinding(parseSecretsJson(decodeText(record.rawBytes)));
    if (isDeepStrictEqual(original, parsed)) return decodeText(record.rawBytes);
  } catch {
    // Raw bytes this binary cannot re-read are re-serialized from the parsed binding below.
  }
  return JSON.stringify(parsed);
};

export const serializeSecretsV2 = (document: SecretsDocumentV2): Uint8Array => {
  assertSecretsDocumentV2(document);
  if (document.rawBytes && matchesSnapshot(document)) return copyBytes(document.rawBytes);
  const serialized = `{"schemaVersion":2,"bindings":[${document.bindings.map(serializeBinding).join(",")}]}\n`;
  const bytes = textEncoder.encode(serialized);
  if (bytes.byteLength > MAX_SECRETS_BYTES) throw new Error("Secrets file is too large");
  return bytes;
};

const isValidAIProvider = (value: string): value is AIProvider => {
  return Object.hasOwn(LEGACY_PROVIDER_ENV_VARS, value);
};

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

const RawSecretsContainerSchema = z
  .object({
    providers: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

const parseSecretsContainer = (stored: z.infer<typeof RawSecretsContainerSchema>): SecretsState => {
  const storedProviders = stored.providers ?? {};

  const migrated: SecretsState["providers"] = {};
  for (const [key, value] of Object.entries(storedProviders)) {
    if (!isValidAIProvider(key)) {
      throw new Error(V1_MIGRATION_FAILED_MESSAGE);
    }

    if (value === "env") {
      migrated[key] = { kind: "env", varName: LEGACY_PROVIDER_ENV_VARS[key] };
      continue;
    }
    const parsed = SecretEntrySchema.safeParse(value);
    if (!parsed.success) {
      throw new Error(V1_MIGRATION_FAILED_MESSAGE);
    }
    if (typeof parsed.data !== "string" && parsed.data.varName !== LEGACY_PROVIDER_ENV_VARS[key]) {
      throw new Error(V1_MIGRATION_FAILED_MESSAGE);
    }
    migrated[key] = parsed.data;
  }

  return { providers: migrated };
};

export const decodeSecretsV1 = (inputBytes: Uint8Array): SecretsState => {
  try {
    const bytes = copyBytes(inputBytes);
    if (bytes.byteLength > MAX_SECRETS_BYTES) throw new Error();
    const text = decodeText(bytes);
    scanJsonRejectingDuplicateKeys(text, {
      maxBytes: MAX_SECRETS_BYTES,
      maxDepth: MAX_SECRETS_JSON_DEPTH,
      onFail: () => {
        throw new Error();
      },
    });
    const parsed = RawSecretsContainerSchema.safeParse(parseSecretsJson(text));
    if (!parsed.success) throw new Error();
    return parseSecretsContainer(parsed.data);
  } catch {
    throw new Error(V1_MIGRATION_FAILED_MESSAGE);
  }
};
