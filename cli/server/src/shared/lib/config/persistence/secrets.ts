import { readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { z } from "zod";
import { getGlobalSecretsPath } from "../../paths.js";
import { type SecretBinding, SecretBindingSchema } from "../secret-bindings.js";
import type { SecretsState } from "../types.js";
import { loadOrQuarantine } from "./load-json.js";

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

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const MAX_SECRETS_BYTES = 2 * 1024 * 1024;
const MAX_BINDING_BYTES = 256 * 1024;

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

const splitBindingBytes = (text: string): Uint8Array[] => {
  const parsed = JSON.parse(text) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Secrets root must be an object");
  }
  const root = parsed as Record<string, unknown>;
  if (root.schemaVersion !== SECRETS_SCHEMA_VERSION_V2) {
    throw new Error("Secrets file is not schemaVersion 2");
  }
  if (!Array.isArray(root.bindings)) throw new Error("Secrets file has no bindings");
  return root.bindings.map((binding) => textEncoder.encode(JSON.stringify(binding)));
};

const decodeSecretBinding = (rawBytes: Uint8Array): DecodedSecretBinding => {
  if (rawBytes.byteLength > MAX_BINDING_BYTES) {
    throw new Error("Secret binding exceeds the size limit");
  }
  let value: unknown;
  try {
    value = JSON.parse(decodeText(rawBytes));
  } catch {
    return { status: "unknown", rawBytes: copyBytes(rawBytes) };
  }
  const parsed = SecretBindingSchema.safeParse(value);
  if (!parsed.success) return { status: "unknown", rawBytes: copyBytes(rawBytes) };
  if (parsed.data.status === "active") {
    return { status: "supported", binding: parsed.data, rawBytes: copyBytes(rawBytes) };
  }
  return {
    status: parsed.data.status,
    binding: parsed.data,
    rawBytes: copyBytes(rawBytes),
  };
};

const assertSecretsDocumentV2 = (document: SecretsDocumentV2): void => {
  if (document.schemaVersion !== SECRETS_SCHEMA_VERSION_V2) {
    throw new Error("Secrets writer requires schemaVersion 2");
  }
  const identities = new Set<string>();
  for (const record of document.bindings) {
    if (record.rawBytes.byteLength > MAX_BINDING_BYTES) {
      throw new Error("Secret binding exceeds the size limit");
    }
    if (!record.binding) continue;
    const binding = SecretBindingSchema.parse(record.binding);
    const key = `${binding.configurationId}\u0000${binding.revision}`;
    if (identities.has(key)) throw new Error("Duplicate secret binding identity");
    identities.add(key);
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
  return document;
};

const serializeBinding = (record: DecodedSecretBinding): string => {
  if (!record.binding) return decodeText(record.rawBytes);
  const parsed = SecretBindingSchema.parse(record.binding);
  try {
    const original = SecretBindingSchema.parse(JSON.parse(decodeText(record.rawBytes)));
    if (isDeepStrictEqual(original, parsed)) return decodeText(record.rawBytes);
  } catch {}
  return JSON.stringify(parsed);
};

export const serializeSecretsV2 = (document: SecretsDocumentV2): Uint8Array => {
  assertSecretsDocumentV2(document);
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

const RawSecretsContainerSchema = z.object({
  providers: z.record(z.string(), z.unknown()).catch({}).optional(),
});

let _secretsPath: string | undefined;

const SECRETS_PATH = (): string => {
  _secretsPath ??= getGlobalSecretsPath();
  return _secretsPath;
};

export const loadSecretsV2 = (): SecretsDocumentV2 => {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(SECRETS_PATH()));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return { schemaVersion: SECRETS_SCHEMA_VERSION_V2, bindings: [] };
    }
    throw error;
  }
  return decodeSecretsV2(bytes);
};

const parseSecretsContainer = (
  stored: z.infer<typeof RawSecretsContainerSchema> | null,
): SecretsState => {
  const storedProviders = stored?.providers ?? {};

  const migrated: SecretsState["providers"] = {};
  const unknown: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(storedProviders)) {
    if (!isValidAIProvider(key)) {
      unknown[key] = value;
      continue;
    }

    if (value === "env") {
      migrated[key] = { kind: "env", varName: LEGACY_PROVIDER_ENV_VARS[key] };
      continue;
    }
    const parsed = SecretEntrySchema.safeParse(value);
    if (!parsed.success) {
      unknown[key] = value;
      continue;
    }
    if (typeof parsed.data !== "string" && parsed.data.varName !== LEGACY_PROVIDER_ENV_VARS[key]) {
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

/**
 * Read-only V1 loader. The provider-keyed secrets file has no writer any more;
 * it exists solely as the source of the one-way upgrade to V2 bindings.
 */
export const loadSecretsV1 = (): SecretsState => {
  const stored = loadOrQuarantine(SECRETS_PATH(), "secrets", RawSecretsContainerSchema);
  return parseSecretsContainer(stored);
};
