import { sha256CanonicalJsonSync } from "@diffgazer/core/json";
import { err, ok, type Result } from "@diffgazer/core/result";
import type {
  ConfigurationId,
  ConfigurationRevision,
  SecretsStorage,
} from "@diffgazer/core/schemas/config";
import { log } from "../../log.js";
import type { DecodedSecretBinding } from "../persistence/secrets.js";
import {
  bindWriteOnlySecret,
  createEnvironmentSecretBinding,
  createLocalBearerBinding,
  createNoneSecretBinding,
  deleteSecretBinding,
  markSecretBindingRemoved,
  type SecretBinding,
  type SecretBindingIO,
} from "../secret-bindings.js";
import { type ConfigurationActionError, configurationActionFailure } from "../types.js";

type CredentialLifecycleDependencies = Readonly<{
  secretIO: SecretBindingIO;
  getStorage: () => SecretsStorage;
  literalSecretPath: (configurationId: string, revision: number) => string;
  keyringSecretName: (configurationId: string, revision: number) => string;
  encodeBytes: (value: unknown) => Uint8Array;
  canonicalEnv: (productId: string) => string | null;
}>;

export type DiscardBindingSecretOptions = Readonly<{
  onResult?: (deleted: boolean) => void;
}>;

export function credentialReferenceIdentityFor(binding: SecretBinding | null): string | null {
  if (!binding) return null;
  switch (binding.kind) {
    case "none":
      return null;
    case "environment-reference":
      return sha256CanonicalJsonSync({ kind: "environment-reference", varName: binding.varName });
    case "keyring-reference":
      return sha256CanonicalJsonSync({ kind: "keyring-reference", keyId: binding.keyId });
    case "file-0600":
      return sha256CanonicalJsonSync({ kind: "file-0600", filePath: binding.filePath });
    case "optional-local-bearer":
      return sha256CanonicalJsonSync({
        kind: "optional-local-bearer",
        storage: binding.storage,
        reference: binding.reference,
      });
  }
}

/**
 * The credential references these bindings still resolve. Every step on the
 * deletion path asks this same question before it destroys secret material, so
 * they must all answer it the same way.
 */
export function activeCredentialReferences(bindings: readonly DecodedSecretBinding[]): Set<string> {
  const references = new Set<string>();
  for (const entry of bindings) {
    const binding = entry.binding;
    if (!binding || binding.status !== "active") continue;
    const reference = credentialReferenceIdentityFor(binding);
    if (reference !== null) references.add(reference);
  }
  return references;
}

export function retiredBindingTombstones(
  nextBindings: readonly DecodedSecretBinding[],
  replacedBindings: readonly SecretBinding[],
): SecretBinding[] {
  const retainedReferences = activeCredentialReferences(nextBindings);
  return replacedBindings
    .filter((binding) => {
      const reference = credentialReferenceIdentityFor(binding);
      return reference === null || !retainedReferences.has(reference);
    })
    .map(markSecretBindingRemoved);
}

export function createCredentialLifecycle(deps: CredentialLifecycleDependencies) {
  const bindEnvironmentSecret = (
    productId: string,
    configurationId: ConfigurationId,
    revision: ConfigurationRevision,
    localBearer: boolean,
  ): Result<SecretBinding, ConfigurationActionError> => {
    const varName = deps.canonicalEnv(productId);
    if (varName === null) {
      return err(
        configurationActionFailure(
          "SECRET_BINDING_FAILED",
          "No canonical environment variable exists for this product",
        ),
      );
    }
    return ok(
      localBearer
        ? createLocalBearerBinding(configurationId, revision, "environment-reference", varName)
        : createEnvironmentSecretBinding(configurationId, revision, varName),
    );
  };

  const secretBindingFailure = (cause: unknown): ConfigurationActionError => {
    log("warn", "config_secret_binding_failed", {
      error: cause instanceof Error ? cause.message : String(cause),
    });
    return configurationActionFailure(
      "SECRET_BINDING_FAILED",
      "Secret binding could not be persisted",
    );
  };

  const encodeDecodedBinding = (binding: SecretBinding): DecodedSecretBinding => ({
    status: binding.status === "active" ? "supported" : binding.status,
    binding,
    rawBytes: deps.encodeBytes(binding),
  });

  const bindActionSecret = async (
    configurationId: ConfigurationId,
    revision: ConfigurationRevision,
    input: {
      readonly transportFamily: string;
      readonly productId: string;
      readonly credential?:
        | { readonly kind: "literal"; readonly value: string }
        | { readonly kind: "environment" };
      readonly authentication?: string;
      readonly bearerToken?:
        | { readonly kind: "literal"; readonly value: string }
        | { readonly kind: "environment" };
    },
  ): Promise<Result<SecretBinding, ConfigurationActionError>> => {
    try {
      if (input.transportFamily === "local-cli")
        return ok(createNoneSecretBinding(configurationId, revision));
      if (input.transportFamily === "hosted-api") {
        if (!input.credential) return ok(createNoneSecretBinding(configurationId, revision));
        if (input.credential.kind === "environment") {
          return bindEnvironmentSecret(input.productId, configurationId, revision, false);
        }
        const storage = deps.getStorage();
        return ok(
          await bindWriteOnlySecret(configurationId, revision, input.credential, {
            keyring: deps.secretIO.keyring,
            ...(storage === "keyring"
              ? { keyId: deps.keyringSecretName(configurationId, revision) }
              : { filePath: deps.literalSecretPath(configurationId, revision) }),
          }),
        );
      }
      if (input.authentication === "none")
        return ok(createNoneSecretBinding(configurationId, revision));
      if (!input.bearerToken) {
        return err(
          configurationActionFailure(
            "SECRET_BINDING_FAILED",
            "Bearer credential is required for optional local bearer authentication",
          ),
        );
      }
      if (input.bearerToken.kind === "environment") {
        return bindEnvironmentSecret(input.productId, configurationId, revision, true);
      }
      const storage = deps.getStorage();
      return ok(
        await bindWriteOnlySecret(configurationId, revision, input.bearerToken, {
          localBearer: true,
          keyring: deps.secretIO.keyring,
          ...(storage === "keyring"
            ? { keyId: deps.keyringSecretName(configurationId, revision) }
            : { filePath: deps.literalSecretPath(configurationId, revision) }),
        }),
      );
    } catch (cause) {
      return err(secretBindingFailure(cause));
    }
  };

  const discardBindingSecret = async (
    binding: SecretBinding,
    options?: DiscardBindingSecretOptions,
  ): Promise<void> => {
    let deleted = false;
    try {
      await deleteSecretBinding(binding, deps.secretIO);
      deleted = true;
    } catch (cause) {
      log("warn", "config_binding_rollback_failed", {
        error: cause instanceof Error ? cause.message : String(cause),
      });
    }
    options?.onResult?.(deleted);
  };

  const tombstonesForRetiredBindings = (
    nextBindings: readonly DecodedSecretBinding[],
    replacedBindings: readonly SecretBinding[],
  ): DecodedSecretBinding[] =>
    retiredBindingTombstones(nextBindings, replacedBindings).map(encodeDecodedBinding);

  const deleteRetiredSecretMaterial = async (
    removed: readonly SecretBinding[],
    retained: readonly DecodedSecretBinding[],
  ): Promise<SecretBinding[]> => {
    const retainedReferences = activeCredentialReferences(retained);
    const failed: SecretBinding[] = [];
    const tryDelete = async (binding: SecretBinding): Promise<void> => {
      const reference = credentialReferenceIdentityFor(binding);
      if (reference === null || retainedReferences.has(reference)) return;
      try {
        await deleteSecretBinding(binding, deps.secretIO);
      } catch (cause) {
        log("warn", "config_binding_delete_failed", {
          error: cause instanceof Error ? cause.message : String(cause),
        });
        failed.push(binding);
      }
    };
    for (const binding of removed.filter((candidate) => candidate.status === "removed")) {
      await tryDelete(binding);
    }
    if (failed.length === 0) {
      for (const binding of removed.filter((candidate) => candidate.status !== "removed")) {
        await tryDelete(binding);
      }
    }
    return failed;
  };

  return {
    bindActionSecret,
    discardBindingSecret,
    encodeDecodedBinding,
    tombstonesForRetiredBindings,
    deleteRetiredSecretMaterial,
  };
}
