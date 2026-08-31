import { err, ok, type Result } from "@diffgazer/core/result";
import {
  applySettingsPatch,
  type ClientConfigurationSummary,
  type ConfigurationId,
  type SecretsStorage,
  type SettingsConfig,
} from "@diffgazer/core/schemas/config";
import { RUNTIME_IDENTITY, STRUCTURED_OUTPUT_SCHEMA_SHA256 } from "../../ai/admission/protocol.js";
import { log } from "../../log.js";
import { isKeyringAvailable } from "../keyring.js";
import { parseSettingsRecord } from "../persistence/config.js";
import { literalCredentialFilePath } from "../persistence/credential-file-path.js";
import type { DecodedSecretBinding } from "../persistence/secrets.js";
import type { SupportedProviderConfigurationRecord } from "../provider-config.js";
import { computeProviderReadinessResult, type ProviderReadinessInput } from "../readiness.js";
import type { SecretBinding } from "../secret-binding-model.js";
import { secretIO } from "../secret-io.js";
import { getConfigurationSecretName } from "../secrets-store.js";
import { type ConfigurationActionError, configurationActionFailure } from "../types.js";
import {
  activeCredentialReferences,
  credentialReferenceIdentityFor,
  type DiscardBindingSecretOptions,
  retiredBindingTombstones,
} from "./credential-lifecycle.js";
import type { DocumentStore } from "./document-store.js";
import { createSettingsMigration } from "./settings.js";
import {
  type CapturedConfigurationSnapshot,
  type ConfigurationSnapshot,
  projectConfigurationSnapshot,
} from "./snapshot.js";

type SnapshotSettingsDependencies = Readonly<{
  documents: DocumentStore;
  getSettings: () => SettingsConfig;
  findBindingForIdentity: (
    configurationId: ConfigurationId,
    revision: number,
  ) => SecretBinding | null;
  projectSummary: (
    record: SupportedProviderConfigurationRecord,
  ) => Result<ClientConfigurationSummary, ConfigurationActionError>;
  discardBindingSecret: (
    binding: SecretBinding,
    options?: DiscardBindingSecretOptions,
  ) => Promise<void>;
  encodeDecodedBinding: (binding: SecretBinding) => DecodedSecretBinding;
}>;

export function createSnapshotSettingsActions(deps: SnapshotSettingsDependencies) {
  const settingsMigration = createSettingsMigration({
    secretIO,
    literalSecretPath: literalCredentialFilePath,
    keyringSecretName: getConfigurationSecretName,
    discardBindingSecret: deps.discardBindingSecret,
    encodeDecodedBinding: deps.encodeDecodedBinding,
  });

  const cleanupKeyFor = (binding: SecretBinding): string => {
    const reference = credentialReferenceIdentityFor(binding);
    return reference ?? `${binding.configurationId}\u0000${binding.revision}`;
  };

  const appendTombstones = (
    bindings: readonly DecodedSecretBinding[],
    retired: readonly SecretBinding[],
  ): DecodedSecretBinding[] => [
    ...bindings,
    ...retiredBindingTombstones(bindings, retired).map(deps.encodeDecodedBinding),
  ];

  const hasPendingTombstones = (): boolean =>
    deps.documents
      .getSecretsDocument()
      .bindings.some((entry) => entry.binding?.status === "removed");

  const cleanupRetiredBindings = async (): Promise<Result<void, ConfigurationActionError>> => {
    const document = deps.documents.getSecretsDocument();
    const activeReferences = activeCredentialReferences(document.bindings);

    const attempted = new Set<string>();
    const confirmed = new Set<string>();
    for (const entry of document.bindings) {
      const binding = entry.binding;
      if (!binding || binding.status !== "removed") continue;
      const reference = credentialReferenceIdentityFor(binding);
      const cleanupKey = cleanupKeyFor(binding);
      if (reference !== null && activeReferences.has(reference)) {
        confirmed.add(cleanupKey);
        continue;
      }
      if (attempted.has(cleanupKey)) continue;
      attempted.add(cleanupKey);
      let deleted = false;
      await deps.discardBindingSecret(binding, {
        onResult: (result) => {
          deleted = result;
        },
      });
      if (deleted) confirmed.add(cleanupKey);
    }

    if (confirmed.size === 0) return ok(undefined);
    const remaining = document.bindings.filter((entry) => {
      const binding = entry.binding;
      return !binding || binding.status !== "removed" || !confirmed.has(cleanupKeyFor(binding));
    });
    if (remaining.length === document.bindings.length) return ok(undefined);
    deps.documents.setSecretsDocument({ ...document, bindings: remaining });
    const persisted = await deps.documents.writeDocuments();
    if (!persisted.ok) {
      log("warn", "config_binding_tombstone_clear_failed", {});
      return persisted;
    }
    return ok(undefined);
  };

  const persistRollbackTombstones = async (
    newBindings: readonly SecretBinding[],
  ): Promise<Result<void, ConfigurationActionError>> => {
    const document = deps.documents.getSecretsDocument();
    const tombstones = retiredBindingTombstones(document.bindings, newBindings).map(
      deps.encodeDecodedBinding,
    );
    if (tombstones.length === 0) return ok(undefined);
    deps.documents.setSecretsDocument({
      ...document,
      bindings: [...document.bindings, ...tombstones],
    });
    return deps.documents.writeDocuments();
  };

  const readConfigurationSnapshot = async (): Promise<
    Result<ConfigurationSnapshot, ConfigurationActionError>
  > => {
    const captured = await deps.documents.runRead(async () =>
      ok<CapturedConfigurationSnapshot>({
        rows: deps.documents.getConfigDocument().configurations.map((record) => {
          if (record.status === "unknown") return { kind: "unknown", record };
          const configuration = record.record;
          const binding = deps.findBindingForIdentity(
            configuration.configurationId,
            configuration.revision,
          );
          const evidence = deps.documents.getEvidence(configuration.configurationId);
          const readinessInput: ProviderReadinessInput = {
            configuration,
            binding,
            evidence,
            runtime: RUNTIME_IDENTITY,
            structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
            credentialReferenceIdentity: binding ? credentialReferenceIdentityFor(binding) : null,
          };
          return { kind: "supported", configuration, readinessInput };
        }),
        selectedConfigurationId: deps.documents.getConfigDocument().selectedConfigurationId,
        settings: deps.getSettings(),
      }),
    );
    if (!captured.ok) return captured;
    return projectConfigurationSnapshot(captured.value, {
      summaryFor: deps.projectSummary,
      computeReadiness: (input) => computeProviderReadinessResult(input).readiness,
    });
  };

  const updateSettings = (
    patch: Partial<SettingsConfig>,
  ): Promise<Result<SettingsConfig, ConfigurationActionError>> =>
    deps.documents.runMutation(async () => {
      const current = parseSettingsRecord(deps.documents.getConfigDocument().settings);
      const nextSettings: SettingsConfig = { ...current.settings, ...patch };
      if (current.settings.secretsStorage !== null && nextSettings.secretsStorage === null) {
        return err(
          configurationActionFailure(
            "STORAGE_NOT_CONFIGURED",
            "Secrets storage cannot be cleared after configuration",
          ),
        );
      }
      const previousStorage: SecretsStorage =
        current.settings.secretsStorage === "keyring" ? "keyring" : "file";
      const nextStorage: SecretsStorage =
        nextSettings.secretsStorage === "keyring" ? "keyring" : "file";
      // Only a patch that moves credentials into the keyring needs a live probe.
      // Settings that own no credential (theme, lenses, profile...) must stay
      // writable while the keychain is locked.
      if (
        nextStorage === "keyring" &&
        previousStorage !== "keyring" &&
        !(await isKeyringAvailable({ refresh: true }))
      ) {
        return err(
          configurationActionFailure("KEYRING_UNAVAILABLE", "Keyring storage is not available"),
        );
      }

      let migrationNewBindings: SecretBinding[] = [];
      if (current.settings.secretsStorage !== null && previousStorage !== nextStorage) {
        const cleaned = await cleanupRetiredBindings();
        if (!cleaned.ok) return cleaned;
        if (hasPendingTombstones()) {
          return err(
            configurationActionFailure(
              "SECRET_BINDING_FAILED",
              "Pending credential cleanup must complete before changing secrets storage",
            ),
          );
        }
        const migrated = await settingsMigration.migrateBindingsForStorageChange(
          deps.documents.getSecretsDocument().bindings,
          nextStorage,
        );
        if (!migrated.ok) return migrated;
        deps.documents.setSecretsDocument({
          ...deps.documents.getSecretsDocument(),
          bindings: appendTombstones(migrated.value.bindings, migrated.value.replacedBindings),
        });
        migrationNewBindings = migrated.value.newBindings;
      }

      deps.documents.setConfigDocument({
        ...deps.documents.getConfigDocument(),
        settings: applySettingsPatch(deps.documents.getConfigDocument().settings, patch),
      });
      const persisted = await deps.documents.writeDocuments();
      if (!persisted.ok) {
        if (persisted.error.code !== "PERSIST_FAILED") return persisted;
        const tracked = await persistRollbackTombstones(migrationNewBindings);
        if (!tracked.ok) {
          if (tracked.error.code !== "PERSIST_FAILED") return tracked;
          for (const binding of migrationNewBindings) await deps.discardBindingSecret(binding);
          return persisted;
        }
        const cleaned = await cleanupRetiredBindings();
        if (!cleaned.ok) return cleaned;
        return persisted;
      }
      const cleaned = await cleanupRetiredBindings();
      if (!cleaned.ok) return cleaned;
      return ok(deps.getSettings());
    });

  const retryPendingTombstones = async (): Promise<void> => {
    if (!hasPendingTombstones()) return;
    await deps.documents.runMutation(cleanupRetiredBindings);
  };

  // A crash or a failed cleanup leaves tombstones behind, so retry them once the documents
  // are loaded. Registered as startup work rather than fired and forgotten: `ready()` drains
  // it, so these credential deletes can never outlive the store that scheduled them.
  deps.documents.scheduleStartupWork(retryPendingTombstones);

  return { readConfigurationSnapshot, updateSettings };
}
