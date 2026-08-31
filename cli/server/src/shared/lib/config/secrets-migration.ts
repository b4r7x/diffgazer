import { createError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  ConfigurationIdSchema,
  ConfigurationRevisionSchema,
  LEGACY_PROVIDER_IDS_V1,
} from "@diffgazer/core/schemas/config";
import { literalCredentialFilePath } from "./persistence/credential-file-path.js";
import {
  createEnvironmentSecretBinding,
  createFileSecretBinding,
  createKeyringSecretBinding,
  createNoneSecretBinding,
  type SecretBinding,
  SecretBindingError,
} from "./secret-binding-model.js";
import { resolveSecretBinding, writeSecretBinding } from "./secret-bindings.js";
import { secretIO } from "./secret-io.js";
import { getConfigurationSecretName } from "./secrets-store.js";
import type {
  SecretEntry,
  SecretsState,
  SecretsStorageError,
  SecretsStorageErrorCode,
} from "./types.js";
import { V1_MIGRATION_FAILED_MESSAGE } from "./types.js";

const MIGRATABLE_V1_PROVIDERS: ReadonlySet<string> = new Set(LEGACY_PROVIDER_IDS_V1);

/** The provider-keyed keyring name a V1 install used while `secretsStorage` was `keyring`. */
const legacyKeyringName = (provider: string): string => `api_key_${provider}`;

export type V1SecretsStorage = "file" | "keyring";

export interface LegacySecretConfiguration {
  readonly provider: string;
  readonly configurationId: string;
  readonly revision: number;
  readonly hasApiKey: boolean;
}

/** A V1 secret that must reach its V2 destination before the V2 documents commit. */
export type V1CredentialTransfer =
  | { readonly kind: "file"; readonly binding: SecretBinding; readonly value: string }
  | { readonly kind: "keyring"; readonly binding: SecretBinding; readonly legacyKeyId: string };

interface V1SecretMigrationPreflight {
  readonly bindings: readonly SecretBinding[];
  readonly transfers: readonly V1CredentialTransfer[];
}

const migrationFailure = (): Result<never, SecretsStorageError> =>
  err(
    createError<SecretsStorageErrorCode>("SECRETS_MIGRATION_FAILED", V1_MIGRATION_FAILED_MESSAGE),
  );

const validIdentity = (item: LegacySecretConfiguration): boolean =>
  ConfigurationIdSchema.safeParse(item.configurationId).success &&
  ConfigurationRevisionSchema.safeParse(item.revision).success;

const isEnvironmentEntry = (
  entry: SecretEntry | undefined,
): entry is Extract<SecretEntry, { kind: "env" }> =>
  typeof entry === "object" &&
  entry !== null &&
  entry.kind === "env" &&
  typeof entry.varName === "string" &&
  entry.varName.length > 0;

/**
 * Classifies every V1 record before any credential I/O happens.
 *
 * The V1 truth table has four runnable rows: an environment reference and an
 * explicit no-secret record migrate as metadata, a `file` install keeps its
 * literal in `secrets.json`, and a `keyring` install keeps it in the OS keyring
 * under the provider-keyed legacy name. Every other combination is a source that
 * contradicts `hasApiKey` or names two possible sources at once, so it fails
 * closed per record and leaves the V1 bytes untouched.
 */
export function preflightV1SecretsMigration(
  state: SecretsState,
  configurations: readonly LegacySecretConfiguration[],
  storage: V1SecretsStorage,
): Result<V1SecretMigrationPreflight, SecretsStorageError> {
  const entries = state.providers;
  const seenIdentities = new Set<string>();
  const seenProviders = new Set<string>();
  const bindings: SecretBinding[] = [];
  const transfers: V1CredentialTransfer[] = [];

  for (const item of configurations) {
    const identity = `${item.configurationId}\u0000${item.revision}`;
    if (
      !validIdentity(item) ||
      typeof item.hasApiKey !== "boolean" ||
      seenIdentities.has(identity) ||
      seenProviders.has(item.provider) ||
      !MIGRATABLE_V1_PROVIDERS.has(item.provider)
    ) {
      return migrationFailure();
    }
    seenIdentities.add(identity);
    seenProviders.add(item.provider);

    const hasEntry = Object.hasOwn(entries, item.provider);
    const entry = entries[item.provider];
    if (hasEntry && typeof entry !== "string" && !isEnvironmentEntry(entry)) {
      return migrationFailure();
    }
    if (!item.hasApiKey) {
      if (hasEntry) return migrationFailure();
      bindings.push(createNoneSecretBinding(item.configurationId, item.revision));
      continue;
    }
    if (isEnvironmentEntry(entry)) {
      bindings.push(
        createEnvironmentSecretBinding(item.configurationId, item.revision, entry.varName),
      );
      continue;
    }
    if (storage === "keyring") {
      // A keyring install moved its literal out of `secrets.json`; a literal that
      // is still there names a second possible source and cannot be resolved.
      if (hasEntry) return migrationFailure();
      const binding = createKeyringSecretBinding(
        item.configurationId,
        item.revision,
        getConfigurationSecretName(item.configurationId, item.revision),
      );
      bindings.push(binding);
      transfers.push({ kind: "keyring", binding, legacyKeyId: legacyKeyringName(item.provider) });
      continue;
    }
    if (typeof entry !== "string") return migrationFailure();
    const binding = createFileSecretBinding(
      item.configurationId,
      item.revision,
      literalCredentialFilePath(item.configurationId, item.revision),
    );
    bindings.push(binding);
    transfers.push({ kind: "file", binding, value: entry });
  }

  if (Object.keys(entries).some((provider) => !seenProviders.has(provider))) {
    return migrationFailure();
  }
  return ok({ bindings, transfers });
}

const readBindingSecret = async (
  binding: SecretBinding,
): Promise<Result<string | null, SecretsStorageError>> => {
  try {
    return ok(await resolveSecretBinding(binding, secretIO));
  } catch (cause) {
    if (cause instanceof SecretBindingError && cause.code === "FILE_NOT_FOUND") return ok(null);
    return migrationFailure();
  }
};

/**
 * Copies one secret to its V2 destination without ever overwriting a value this
 * migration did not put there: absent writes then verifies by read-back, an equal
 * value is reused so a restarted migration converges, and a different value fails
 * that record closed. The source is never deleted, so an interrupted run is
 * repeatable until the V2 documents commit.
 */
const materializeV1Credential = async (
  binding: SecretBinding,
  value: string,
): Promise<Result<void, SecretsStorageError>> => {
  const existing = await readBindingSecret(binding);
  if (!existing.ok) return existing;
  if (existing.value !== null) {
    return existing.value === value ? ok(undefined) : migrationFailure();
  }

  try {
    await writeSecretBinding(binding, value, secretIO);
  } catch {
    return migrationFailure();
  }
  const verified = await readBindingSecret(binding);
  if (!verified.ok) return verified;
  return verified.value === value ? ok(undefined) : migrationFailure();
};

const transferV1Credential = async (
  transfer: V1CredentialTransfer,
): Promise<Result<void, SecretsStorageError>> => {
  if (transfer.kind === "file") {
    return materializeV1Credential(transfer.binding, transfer.value);
  }
  const source = await readBindingSecret(
    createKeyringSecretBinding(
      transfer.binding.configurationId,
      transfer.binding.revision,
      transfer.legacyKeyId,
    ),
  );
  if (!source.ok) return source;
  if (source.value === null) return migrationFailure();
  return materializeV1Credential(transfer.binding, source.value);
};

/** Runs after the whole document passes preflight, so an invalid record never reaches I/O. */
export async function transferV1Credentials(
  transfers: readonly V1CredentialTransfer[],
): Promise<Result<void, SecretsStorageError>> {
  for (const transfer of transfers) {
    const transferred = await transferV1Credential(transfer);
    if (!transferred.ok) return transferred;
  }
  return ok(undefined);
}
