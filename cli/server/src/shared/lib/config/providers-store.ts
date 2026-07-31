import type { AIProvider, ProviderStatus, SecretsStorage } from "@diffgazer/core/schemas/config";
import type {
  ConfigurationId,
  ConfigurationRevision,
  ProviderConfigurationFile,
  ProviderConfigurationFileRecord,
  RemovedProviderConfigurationRecord,
  SupportedProviderConfigurationRecord,
} from "./provider-config.js";
import {
  assertConfigurationIdentity,
  assertExpectedRevision,
  findProviderConfiguration,
  ProviderConfigurationConflictError,
  replaceProviderConfiguration,
  selectProviderConfiguration,
} from "./provider-config.js";
import {
  markSecretBindingRemoved,
  type SafeSecretBindingProjection,
  type SecretBinding,
  SecretBindingSchema,
  toSafeSecretBinding,
} from "./secret-bindings.js";
import type { ConfigState, SecretsState } from "./types.js";

/**
 * V2 configuration storage is keyed by the complete configuration identity.
 * Provider ids are deliberately absent from this state: one product may have
 * several independent configurations and each revision owns its own binding.
 */
export interface ConfigurationBindingState {
  readonly file: ProviderConfigurationFile;
  readonly bindings: readonly SecretBinding[];
}

export interface SafeConfigurationRevision {
  readonly configurationId?: ConfigurationId;
  readonly revision?: ConfigurationRevision;
  readonly status: ProviderConfigurationFileRecord["status"];
  /** Only the non-sensitive kind/status/identity projection crosses a boundary. */
  readonly binding: SafeSecretBindingProjection | null;
}

/** Stable identity key for maps/locks; it contains no credential material. */
export function configurationRevisionKey(
  configurationId: ConfigurationId,
  revision: ConfigurationRevision,
): string {
  return `${configurationId}\u0000${revision}`;
}

function recordIdentity(
  record: ProviderConfigurationFileRecord,
): { readonly configurationId: ConfigurationId; readonly revision: ConfigurationRevision } | null {
  if (record.status === "unknown") return null;
  return { configurationId: record.record.configurationId, revision: record.record.revision };
}

function assertBindingIdentity(
  binding: SecretBinding,
  expected: { readonly configurationId: ConfigurationId; readonly revision: ConfigurationRevision },
): void {
  if (
    binding.configurationId !== expected.configurationId ||
    binding.revision !== expected.revision
  ) {
    throw new ProviderConfigurationConflictError(
      "Secret binding configuration identity does not match",
    );
  }
}

/** Find a record by both configuration id and revision, never by provider. */
export function findConfigurationRevision(
  file: ProviderConfigurationFile,
  identity: { readonly configurationId: ConfigurationId; readonly revision: ConfigurationRevision },
): ProviderConfigurationFileRecord | undefined {
  const record = findProviderConfiguration(file, identity.configurationId);
  const current = recordIdentity(record ?? { status: "unknown", rawBytes: new Uint8Array() });
  return current && current.revision === identity.revision ? record : undefined;
}

/** Return the exact binding for a configuration revision (including removed ones). */
export function findConfigurationBinding(
  bindings: readonly SecretBinding[],
  identity: { readonly configurationId: ConfigurationId; readonly revision: ConfigurationRevision },
): SecretBinding | undefined {
  return bindings.find(
    (binding) =>
      binding.configurationId === identity.configurationId &&
      binding.revision === identity.revision,
  );
}

/**
 * Replace one binding only.  A revision is part of the key, so updating one
 * configuration cannot overwrite another configuration's credential.
 */
export function replaceConfigurationBinding(
  bindings: readonly SecretBinding[],
  binding: SecretBinding,
  expected?: {
    readonly configurationId: ConfigurationId;
    readonly revision: ConfigurationRevision;
  },
): SecretBinding[] {
  const parsed = SecretBindingSchema.parse(binding);
  if (expected) assertBindingIdentity(parsed, expected);

  const key = configurationRevisionKey(parsed.configurationId, parsed.revision);
  let replaced = false;
  const next = bindings.map((current) => {
    const currentKey = configurationRevisionKey(current.configurationId, current.revision);
    if (currentKey !== key) return current;
    replaced = true;
    return parsed;
  });
  return replaced ? next : [...next, parsed];
}

/** Keep a removed configuration's binding until the user explicitly deletes it. */
export function retainRemovedConfigurationBinding(
  bindings: readonly SecretBinding[],
  identity: { readonly configurationId: ConfigurationId; readonly revision: ConfigurationRevision },
): SecretBinding[] {
  return bindings.map((binding) => {
    if (
      binding.configurationId !== identity.configurationId ||
      binding.revision !== identity.revision
    ) {
      return binding;
    }
    return markSecretBindingRemoved(binding);
  });
}

/** Delete exactly one binding after the caller has completed its lease protocol. */
export function deleteConfigurationBinding(
  bindings: readonly SecretBinding[],
  identity: { readonly configurationId: ConfigurationId; readonly revision: ConfigurationRevision },
): SecretBinding[] {
  return bindings.filter(
    (binding) =>
      binding.configurationId !== identity.configurationId ||
      binding.revision !== identity.revision,
  );
}

/** Select a supported configuration, rejecting removed/unknown records. */
export function selectConfigurationRevision(
  file: ProviderConfigurationFile,
  configurationId: ConfigurationId | null,
): ProviderConfigurationFile {
  return selectProviderConfiguration(file, configurationId);
}

/** Replace one record after checking both its id and expected revision. */
export function replaceConfigurationRevision(
  file: ProviderConfigurationFile,
  expected: { readonly configurationId: ConfigurationId; readonly revision: ConfigurationRevision },
  replacement: SupportedProviderConfigurationRecord | RemovedProviderConfigurationRecord,
): ProviderConfigurationFile {
  assertConfigurationIdentity(replacement, expected.configurationId);
  assertExpectedRevision(replacement, expected.revision);
  return replaceProviderConfiguration(file, expected, replacement);
}

/**
 * Delete a record only by exact identity and only after it has been classified
 * as removed.  Its binding is intentionally handled by the separate binding
 * operation so a failed lease/cancellation cannot drop credentials early.
 */
export function deleteConfigurationRecord(
  state: ConfigurationBindingState,
  identity: { readonly configurationId: ConfigurationId; readonly revision: ConfigurationRevision },
): ConfigurationBindingState {
  const record = findConfigurationRevision(state.file, identity);
  if (!record || record.status !== "removed") {
    throw new ProviderConfigurationConflictError(
      "Only an exact removed configuration revision may be deleted",
    );
  }
  const records = state.file.records.filter((candidate) => {
    const candidateIdentity = recordIdentity(candidate);
    return !(
      candidateIdentity?.configurationId === identity.configurationId &&
      candidateIdentity.revision === identity.revision
    );
  });
  const selectedConfigurationId =
    state.file.selectedConfigurationId === identity.configurationId
      ? null
      : state.file.selectedConfigurationId;
  return {
    file: { ...state.file, selectedConfigurationId, records },
    bindings: deleteConfigurationBinding(state.bindings, identity),
  };
}

/** Client-safe projection: no raw bytes, references, paths, env names, or values. */
export function toSafeConfigurationRevision(
  record: ProviderConfigurationFileRecord | undefined,
  binding?: SecretBinding,
): SafeConfigurationRevision | null {
  if (!record) return null;
  const identity = recordIdentity(record);
  const safeBinding = binding ? toSafeSecretBinding(SecretBindingSchema.parse(binding)) : null;
  return {
    ...(identity ?? {}),
    status: record.status,
    binding: safeBinding,
  };
}

interface ActivateUpdate {
  providerId: string;
  model?: string;
  hasApiKey?: boolean;
  preserveModel?: boolean;
}

export function applyActiveProvider(
  providers: ProviderStatus[],
  update: ActivateUpdate,
): ProviderStatus[] {
  const { providerId, model, hasApiKey, preserveModel = false } = update;
  return providers.map((item) => {
    if (item.provider !== providerId) {
      return { ...item, isActive: false };
    }

    const nextModel = preserveModel && model === undefined ? item.model : model;
    return {
      ...item,
      hasApiKey: hasApiKey ?? item.hasApiKey,
      isActive: true,
      model: nextModel,
    };
  });
}

export function ensureProviderEntry(
  providers: ProviderStatus[],
  providerId: AIProvider,
  hasApiKey: boolean,
): { providers: ProviderStatus[]; entry: ProviderStatus } {
  const existing = providers.find((provider) => provider.provider === providerId);
  if (existing) {
    return { providers, entry: existing };
  }

  const created: ProviderStatus = {
    provider: providerId,
    hasApiKey,
    isActive: false,
  };

  return { providers: [...providers, created], entry: created };
}

export function applyCredentialsWithoutModel(
  providers: ProviderStatus[],
  providerId: AIProvider,
): ProviderStatus[] {
  return providers.map((item) => {
    if (item.provider !== providerId) return item;
    const hasModel = Boolean(item.model);
    return {
      ...item,
      hasApiKey: true,
      isActive: hasModel ? item.isActive : false,
    };
  });
}

export function clearProviderCredentials(
  providers: ProviderStatus[],
  providerId: AIProvider,
): ProviderStatus[] {
  return providers.map((item) => {
    if (item.provider !== providerId) {
      return item;
    }

    return {
      ...item,
      hasApiKey: false,
      isActive: false,
      model: undefined,
    };
  });
}

export function activeProvider(state: ConfigState): ProviderStatus | null {
  const active = state.providers.find((provider) => provider.isActive);
  return active ? { ...active } : null;
}

export function isFileStorage(state: ConfigState): boolean {
  return (state.settings.secretsStorage ?? "file") === "file";
}

export function isStorageConfigured(state: ConfigState): boolean {
  return state.settings.secretsStorage !== null;
}

export function fileHasSecret(secretsState: SecretsState, providerId: string): boolean {
  return providerId in secretsState.providers;
}

export function effectiveStorage(state: ConfigState): SecretsStorage {
  return state.settings.secretsStorage ?? "file";
}
