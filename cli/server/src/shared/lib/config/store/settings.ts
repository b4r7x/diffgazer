import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { SecretsStorage } from "@diffgazer/core/schemas/config";
import { log } from "../../log.js";
import type { DecodedSecretBinding } from "../persistence/secrets.js";
import {
  createFileSecretBinding,
  createKeyringSecretBinding,
  createLocalBearerBinding,
  resolveSecretBinding,
  type SecretBinding,
  type SecretBindingIO,
  writeSecretBinding,
} from "../secret-bindings.js";
import { type ConfigurationActionError, configurationActionFailure } from "../types.js";

type SettingsMigrationDependencies = Readonly<{
  secretIO: SecretBindingIO;
  literalSecretPath: (configurationId: string, revision: number) => string;
  keyringSecretName: (configurationId: string, revision: number) => string;
  discardBindingSecret: (binding: SecretBinding) => Promise<void>;
  encodeDecodedBinding: (binding: SecretBinding) => DecodedSecretBinding;
}>;

export function createSettingsMigration(deps: SettingsMigrationDependencies) {
  const migrateLiteralBinding = async (
    binding: SecretBinding,
    nextStorage: SecretsStorage,
  ): Promise<Result<SecretBinding, ConfigurationActionError>> => {
    try {
      const value = await resolveSecretBinding(binding, deps.secretIO);
      if (value === null) return ok(binding);
      if (nextStorage === "keyring") {
        const keyId = deps.keyringSecretName(binding.configurationId, binding.revision);
        const nextBinding =
          binding.kind === "optional-local-bearer"
            ? createLocalBearerBinding(
                binding.configurationId,
                binding.revision,
                "keyring-reference",
                keyId,
                binding.status,
              )
            : createKeyringSecretBinding(
                binding.configurationId,
                binding.revision,
                keyId,
                binding.status,
              );
        await writeSecretBinding(nextBinding, value, deps.secretIO);
        return ok(nextBinding);
      }
      const filePath = deps.literalSecretPath(binding.configurationId, binding.revision);
      const nextBinding =
        binding.kind === "optional-local-bearer"
          ? createLocalBearerBinding(
              binding.configurationId,
              binding.revision,
              "file-0600",
              filePath,
              binding.status,
            )
          : createFileSecretBinding(
              binding.configurationId,
              binding.revision,
              filePath,
              binding.status,
            );
      await writeSecretBinding(nextBinding, value, deps.secretIO);
      return ok(nextBinding);
    } catch (cause) {
      log("warn", "config_secret_binding_failed", { error: getErrorMessage(cause) });
      return err(
        configurationActionFailure(
          "SECRET_BINDING_FAILED",
          "Secret binding could not be persisted",
        ),
      );
    }
  };

  const migrateBindingsForStorageChange = async (
    bindings: readonly DecodedSecretBinding[],
    nextStorage: SecretsStorage,
  ): Promise<
    Result<
      {
        bindings: DecodedSecretBinding[];
        replacedBindings: SecretBinding[];
        newBindings: SecretBinding[];
      },
      ConfigurationActionError
    >
  > => {
    const migratedBindings: DecodedSecretBinding[] = [];
    const replacedBindings: SecretBinding[] = [];
    const newBindings: SecretBinding[] = [];
    for (const entry of bindings) {
      const binding = entry.binding;
      if (!binding || binding.status !== "active") {
        migratedBindings.push(entry);
        continue;
      }
      const usesFile =
        binding.kind === "file-0600" ||
        (binding.kind === "optional-local-bearer" && binding.storage === "file-0600");
      const usesKeyring =
        binding.kind === "keyring-reference" ||
        (binding.kind === "optional-local-bearer" && binding.storage === "keyring-reference");
      if ((nextStorage === "keyring" && usesFile) || (nextStorage === "file" && usesKeyring)) {
        const migrated = await migrateLiteralBinding(binding, nextStorage);
        if (!migrated.ok) {
          for (const orphan of newBindings) await deps.discardBindingSecret(orphan);
          return migrated;
        }
        replacedBindings.push(binding);
        newBindings.push(migrated.value);
        migratedBindings.push(deps.encodeDecodedBinding(migrated.value));
      } else {
        migratedBindings.push(entry);
      }
    }
    return ok({ bindings: migratedBindings, replacedBindings, newBindings });
  };

  return { migrateBindingsForStorageChange };
}
