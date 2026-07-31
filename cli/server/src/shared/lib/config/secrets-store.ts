import {
  createEnvironmentSecretBinding,
  createFileSecretBinding,
  createKeyringSecretBinding,
  createLocalBearerBinding,
  createNoneSecretBinding,
  resolveSecretBinding,
  type SecretBinding,
  type SecretBindingIO,
  type SecretBindingReferenceInput,
} from "./secret-bindings.js";
import type { SecretEntry } from "./types.js";

type AIProvider = string;

const PROVIDER_ENV_VARS: Readonly<Record<string, string>> = {
  gemini: "GOOGLE_API_KEY",
  zai: "ZAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
};

/**
 * The old provider-keyed state is still decoded by the V1 compatibility
 * reader, but it is not a V2 secret identity.  V2 callers must carry both
 * parts of the binding identity for every read/write.
 */
export interface ConfigurationSecretIdentity {
  readonly configurationId: string;
  readonly revision: number;
}

export type ConfigurationSecretBinding = SecretBinding;

/**
 * Stable keyring namespace for a configuration binding.  Provider names are
 * deliberately absent: two configurations for one product must never share a
 * credential, and a revision change must produce a new key.
 */
export function getConfigurationSecretName(configurationId: string, revision: number): string {
  return `secret_binding_${configurationId}_${revision}`;
}

/** Alias used by storage adapters that call the key a binding key. */
export const getConfigurationBindingKey = getConfigurationSecretName;

/**
 * Construct metadata for a V2 binding.  This helper never accepts a literal
 * secret value.  Literal write-only values are consumed by
 * `bindWriteOnlySecret` in `secret-bindings.ts` and are intentionally absent
 * from the returned metadata.
 */
export function createConfigurationSecretBinding(
  identity: ConfigurationSecretIdentity,
  input: SecretBindingReferenceInput,
): ConfigurationSecretBinding {
  if (input.kind === "environment-reference") {
    return createEnvironmentSecretBinding(
      identity.configurationId,
      identity.revision,
      input.varName,
    );
  }
  if (input.kind === "keyring-reference") {
    return createKeyringSecretBinding(identity.configurationId, identity.revision, input.keyId);
  }
  if (input.kind === "file-0600") {
    return createFileSecretBinding(identity.configurationId, identity.revision, input.filePath);
  }
  if (input.kind === "optional-local-bearer") {
    return createLocalBearerBinding(
      identity.configurationId,
      identity.revision,
      input.storage,
      input.reference,
    );
  }
  return createNoneSecretBinding(identity.configurationId, identity.revision);
}

/** Resolve a V2 binding only after checking its exact identity. */
export function resolveConfigurationSecret(
  binding: ConfigurationSecretBinding,
  identity: ConfigurationSecretIdentity,
  io: SecretBindingIO = {},
): Promise<string | null> {
  return resolveSecretBinding(binding, io, identity);
}

/** Normalize a credential input (string or CredentialRef) into a SecretEntry for persistence. */
export function toSecretEntry(
  apiKey:
    | string
    | { readonly kind: "env"; readonly varName: string }
    | { readonly kind: "literal"; readonly value: string },
  providerId: AIProvider,
): { entry: SecretEntry; resolvedValue: string | null } {
  if (typeof apiKey === "string") {
    // Migrate legacy "env" sentinel strings
    if (apiKey === "env") {
      const varName = PROVIDER_ENV_VARS[providerId] ?? `${providerId.toUpperCase()}_API_KEY`;
      return {
        entry: { kind: "env", varName },
        resolvedValue: process.env[varName] ?? null,
      };
    }
    return { entry: apiKey, resolvedValue: apiKey };
  }
  if (apiKey.kind === "env") {
    return {
      entry: { kind: "env", varName: apiKey.varName },
      resolvedValue: process.env[apiKey.varName] ?? null,
    };
  }
  return { entry: apiKey.value, resolvedValue: apiKey.value };
}

/** Resolve a secret entry to its runtime value. */
export function resolveSecretEntry(entry: SecretEntry): string | null {
  if (typeof entry === "string") return entry;
  if (entry.kind === "env") return process.env[entry.varName] ?? null;
  return null;
}
