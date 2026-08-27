import { randomUUID } from "node:crypto";
import { getErrorMessage } from "@diffgazer/core/errors";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  type ClientConfigurationAction,
  type ClientConfigurationActionResponse,
  type ClientConfigurationInput,
  type ClientConfigurationSummary,
  type ConfigurationId,
  type ConfigurationRevision,
  ExactModelIdSchema,
  type Readiness,
} from "@diffgazer/core/schemas/config";
import { log } from "../../log.js";
import { budgetForSelectedModel } from "../budget-ceiling.js";
import { selectConfigV2 } from "../persistence/config.js";
import type { DecodedSecretBinding } from "../persistence/secrets.js";
import type {
  ConfigurationBudgetLimits,
  DecodedProviderConfigurationRecord,
  NonSecretTransportInput,
  ProviderConfigurationRecord,
  SupportedProviderConfigurationRecord,
} from "../provider-config.js";
import { NonSecretTransportInputSchema } from "../provider-config.js";
import { getConfigSeams } from "../seams.js";
import {
  createNoneSecretBinding,
  type SecretBinding,
  SecretBindingSchema,
} from "../secret-bindings.js";
import {
  type ConfigDocumentV2,
  type ConfigurationActionError,
  configurationActionFailure,
} from "../types.js";
import type { DocumentStore } from "./document-store.js";
import { succeededActionResponse } from "./projection.js";

type CrudActionDependencies = Readonly<{
  documents: DocumentStore;
  defaultBudget: ConfigurationBudgetLimits;
  findRecord: (configurationId: ConfigurationId) => DecodedProviderConfigurationRecord | undefined;
  findBindingForIdentity: (
    configurationId: ConfigurationId,
    revision: ConfigurationRevision,
  ) => SecretBinding | null;
  readinessFor: (configuration: ProviderConfigurationRecord | null) => Readiness;
  projectSummary: (
    record: SupportedProviderConfigurationRecord,
  ) => Result<ClientConfigurationSummary, ConfigurationActionError>;
  bindActionSecret: (
    configurationId: ConfigurationId,
    revision: ConfigurationRevision,
    input: ClientConfigurationInput,
  ) => Promise<Result<SecretBinding, ConfigurationActionError>>;
  discardBindingSecret: (binding: SecretBinding) => Promise<void>;
  encodeDecodedBinding: (binding: SecretBinding) => DecodedSecretBinding;
  tombstonesForRetiredBindings: (
    nextBindings: readonly DecodedSecretBinding[],
    replacedBindings: readonly SecretBinding[],
  ) => DecodedSecretBinding[];
  deleteRetiredSecretMaterial: (
    removed: readonly SecretBinding[],
    retained: readonly DecodedSecretBinding[],
  ) => Promise<SecretBinding[]>;
}>;

const createConfigurationId = (): ConfigurationId => `cfg-${randomUUID()}`;

const toNonSecretInput = (input: ClientConfigurationInput): NonSecretTransportInput =>
  NonSecretTransportInputSchema.parse({
    transportFamily: input.transportFamily,
    productId: input.productId,
    endpoint: input.endpoint,
  });

const replaceRecordInDocument = (
  document: ConfigDocumentV2,
  record: DecodedProviderConfigurationRecord,
  replacement: DecodedProviderConfigurationRecord,
): ConfigDocumentV2 => ({
  ...document,
  configurations: document.configurations.map((candidate) =>
    candidate === record ? replacement : candidate,
  ),
});

export function createCrudActions(deps: CrudActionDependencies) {
  const runCreateAction = async (
    action: Extract<ClientConfigurationAction, { action: "create" }>,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>> => {
    const nonSecretInput = toNonSecretInput(action.input);
    const configurationId = createConfigurationId();
    const product = PRODUCT_REGISTRY[nonSecretInput.productId];
    const now = new Date().toISOString();
    let acknowledgement: SupportedProviderConfigurationRecord["acknowledgement"];
    if (action.acknowledgement) {
      if (
        action.acknowledgement.noticeId !== product.notice.id ||
        action.acknowledgement.noticeVersion !== product.notice.noticeVersion
      ) {
        return err(
          configurationActionFailure(
            "CONFIGURATION_CONFLICT",
            "Notice acknowledgement does not match the product",
          ),
        );
      }
      acknowledgement = {
        noticeId: action.acknowledgement.noticeId,
        noticeVersion: action.acknowledgement.noticeVersion,
        acceptedAt: now,
      };
    } else {
      acknowledgement = {
        noticeId: product.notice.id,
        noticeVersion: product.notice.noticeVersion,
        acceptedAt: null,
      };
    }
    const record: SupportedProviderConfigurationRecord = {
      schemaVersion: 2,
      status: "supported",
      configurationId,
      revision: 1,
      transportFamily: nonSecretInput.transportFamily,
      productId: nonSecretInput.productId,
      input: nonSecretInput,
      selectedModelId: null,
      acknowledgement,
      evidenceReference: null,
      budget: deps.defaultBudget,
      createdAt: now,
      updatedAt: now,
    };
    const summaryResult = deps.projectSummary(record);
    if (!summaryResult.ok) return summaryResult;
    const bindingResult = await deps.bindActionSecret(configurationId, 1, action.input);
    if (!bindingResult.ok) return bindingResult;
    const binding = bindingResult.value;
    deps.documents.setConfigDocument({
      ...deps.documents.getConfigDocument(),
      configurations: [
        ...deps.documents.getConfigDocument().configurations,
        { status: "supported", record, rawBytes: deps.documents.encodeJsonBytes(record) },
      ],
    });
    deps.documents.setSecretsDocument({
      ...deps.documents.getSecretsDocument(),
      bindings: [
        ...deps.documents.getSecretsDocument().bindings,
        deps.encodeDecodedBinding(binding),
      ],
    });
    const persisted = await deps.documents.writeDocuments();
    if (!persisted.ok) {
      // No document commit means nothing references this credential, whatever the
      // failure code, so leaving it behind would strand key material nothing owns.
      await deps.discardBindingSecret(binding);
      return persisted;
    }
    return ok(
      succeededActionResponse("create", {
        configuration: summaryResult.value,
        readiness: deps.readinessFor(record),
      }),
    );
  };

  const runInspectAction = async (
    action: Extract<ClientConfigurationAction, { action: "inspect" }>,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>> => {
    const record = deps.findRecord(action.configurationId);
    if (!record)
      return err(configurationActionFailure("CONFIGURATION_NOT_FOUND", "Configuration not found"));
    if (record.status === "unknown") {
      return err(
        configurationActionFailure("CONFIGURATION_UNSUPPORTED", "Configuration is not supported"),
      );
    }
    const summaryResult = deps.projectSummary(record.record);
    if (!summaryResult.ok) return summaryResult;
    return ok(
      succeededActionResponse("inspect", {
        configuration: summaryResult.value,
        readiness: deps.readinessFor(record.record),
      }),
    );
  };

  const runSelectAction = async (
    action: Extract<ClientConfigurationAction, { action: "select" }>,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>> => {
    const modelId = ExactModelIdSchema.safeParse(action.modelId);
    if (!modelId.success) {
      return err(configurationActionFailure("INVALID_ACTION", "Model id is not an exact model id"));
    }
    const record = deps.findRecord(action.configurationId);
    if (!record)
      return err(configurationActionFailure("CONFIGURATION_NOT_FOUND", "Configuration not found"));
    if (record.status !== "supported") {
      return err(
        configurationActionFailure("CONFIGURATION_UNSUPPORTED", "Configuration is not supported"),
      );
    }
    const nextRecord: SupportedProviderConfigurationRecord = {
      ...record.record,
      selectedModelId: modelId.data,
      budget: budgetForSelectedModel(record.record.budget, record.record.productId, modelId.data),
      evidenceReference: null,
      updatedAt: new Date().toISOString(),
    };
    const summaryResult = deps.projectSummary(nextRecord);
    if (!summaryResult.ok) return summaryResult;
    deps.documents.setConfigDocument(
      selectConfigV2(
        replaceRecordInDocument(deps.documents.getConfigDocument(), record, {
          status: "supported",
          record: nextRecord,
          rawBytes: deps.documents.encodeJsonBytes(nextRecord),
        }),
        action.configurationId,
      ),
    );
    const persisted = await deps.documents.writeDocuments();
    if (!persisted.ok) return persisted;
    deps.documents.clearConfigurationEvidence(action.configurationId);
    return ok(
      succeededActionResponse("select", {
        configuration: summaryResult.value,
        readiness: deps.readinessFor(nextRecord),
      }),
    );
  };

  const runUpdateAction = async (
    action: Extract<ClientConfigurationAction, { action: "update" }>,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>> => {
    const configurationId = action.configurationId;
    const record = deps.findRecord(configurationId);
    if (!record)
      return err(configurationActionFailure("CONFIGURATION_NOT_FOUND", "Configuration not found"));
    if (record.status !== "supported") {
      return err(
        configurationActionFailure("CONFIGURATION_UNSUPPORTED", "Configuration is not supported"),
      );
    }
    if (record.record.revision !== action.expectedRevision) {
      return err(
        configurationActionFailure("CONFIGURATION_CONFLICT", "Configuration revision conflict"),
      );
    }
    const nonSecretInput = toNonSecretInput(action.input);
    if (nonSecretInput.productId !== record.record.productId) {
      return err(
        configurationActionFailure(
          "CONFIGURATION_CONFLICT",
          "Configuration product cannot be changed on update",
        ),
      );
    }
    const product = PRODUCT_REGISTRY[nonSecretInput.productId];
    if (
      action.acknowledgement.noticeId !== product.notice.id ||
      action.acknowledgement.noticeVersion !== product.notice.noticeVersion
    ) {
      return err(
        configurationActionFailure(
          "CONFIGURATION_CONFLICT",
          "Notice acknowledgement does not match the product",
        ),
      );
    }
    const now = new Date().toISOString();
    const nextRecord: SupportedProviderConfigurationRecord = {
      ...record.record,
      revision: record.record.revision + 1,
      transportFamily: nonSecretInput.transportFamily,
      productId: nonSecretInput.productId,
      input: nonSecretInput,
      acknowledgement: {
        noticeId: action.acknowledgement.noticeId,
        noticeVersion: action.acknowledgement.noticeVersion,
        acceptedAt: now,
      },
      evidenceReference: null,
      updatedAt: now,
    };
    const summaryResult = deps.projectSummary(nextRecord);
    if (!summaryResult.ok) return summaryResult;
    const previousBinding = deps.findBindingForIdentity(configurationId, record.record.revision);
    const secretInput = action.input.credential;
    const bindingResult =
      secretInput !== undefined
        ? await deps.bindActionSecret(configurationId, nextRecord.revision, action.input)
        : ok<SecretBinding | undefined>(undefined);
    if (!bindingResult.ok) return bindingResult;
    const newBinding = bindingResult.value;

    const replacedBindings: SecretBinding[] = [];
    let nextBindings = deps.documents.getSecretsDocument().bindings.filter((entry) => {
      const binding = entry.binding;
      const replaced =
        binding &&
        binding.configurationId === configurationId &&
        binding.revision === record.record.revision;
      if (replaced) replacedBindings.push(binding);
      return !replaced;
    });
    if (newBinding !== undefined) {
      nextBindings = [...nextBindings, deps.encodeDecodedBinding(newBinding)];
    } else if (previousBinding) {
      const carried = SecretBindingSchema.parse({
        ...previousBinding,
        revision: nextRecord.revision,
      });
      nextBindings = [...nextBindings, deps.encodeDecodedBinding(carried)];
    } else {
      nextBindings = [
        ...nextBindings,
        deps.encodeDecodedBinding(createNoneSecretBinding(configurationId, nextRecord.revision)),
      ];
    }
    const retiredTombstones = deps.tombstonesForRetiredBindings(nextBindings, replacedBindings);
    if (retiredTombstones.length > 0) nextBindings = [...nextBindings, ...retiredTombstones];

    deps.documents.setConfigDocument(
      replaceRecordInDocument(deps.documents.getConfigDocument(), record, {
        status: "supported",
        record: nextRecord,
        rawBytes: deps.documents.encodeJsonBytes(nextRecord),
      }),
    );
    deps.documents.setSecretsDocument({
      ...deps.documents.getSecretsDocument(),
      bindings: nextBindings,
    });
    const persisted = await deps.documents.writeDocuments();
    if (!persisted.ok) {
      if (newBinding !== undefined) await deps.discardBindingSecret(newBinding);
      return persisted;
    }
    deps.documents.clearConfigurationEvidence(configurationId);
    await deps.deleteRetiredSecretMaterial(replacedBindings, nextBindings);
    return ok(
      succeededActionResponse("update", {
        configuration: summaryResult.value,
        readiness: deps.readinessFor(nextRecord),
      }),
    );
  };

  const assertDeletable = (
    action: Extract<ClientConfigurationAction, { action: "delete" }>,
  ): Result<void, ConfigurationActionError> => {
    const record = deps.findRecord(action.configurationId);
    if (!record)
      return err(configurationActionFailure("CONFIGURATION_NOT_FOUND", "Configuration not found"));
    // An unknown record carries no revision to match, and every other product
    // path already refuses it — refusing here too would make a configuration
    // whose product this build retired permanently unremovable. Every record the
    // server can describe still has to match the revision the client saw, and an
    // omitted expectedRevision matches no revision.
    if (record.status === "unknown") return ok(undefined);
    if (record.record.revision !== action.expectedRevision) {
      return err(
        configurationActionFailure("CONFIGURATION_CONFLICT", "Configuration revision conflict"),
      );
    }
    return ok(undefined);
  };

  const commitDelete = async (
    action: Extract<ClientConfigurationAction, { action: "delete" }>,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>> => {
    const configurationId = action.configurationId;
    // The drain ran with the documents unlocked, so the tuple is re-checked here
    // against the state this transaction reloaded.
    const deletable = assertDeletable(action);
    if (!deletable.ok) return deletable;
    const bindingsToDelete: SecretBinding[] = [];
    const retainedBindings: DecodedSecretBinding[] = [];
    for (const entry of deps.documents.getSecretsDocument().bindings) {
      const binding = entry.binding;
      if (!binding || binding.configurationId !== configurationId) {
        retainedBindings.push(entry);
        continue;
      }
      bindingsToDelete.push(binding);
    }
    const configBeforeDelete = deps.documents.getConfigDocument();
    const secretsBeforeDelete = deps.documents.getSecretsDocument();
    deps.documents.setConfigDocument({
      ...deps.documents.getConfigDocument(),
      configurations: deps.documents
        .getConfigDocument()
        .configurations.filter(
          (candidate) =>
            (candidate.status === "unknown"
              ? candidate.configurationId
              : candidate.record.configurationId) !== configurationId,
        ),
      selectedConfigurationId:
        deps.documents.getConfigDocument().selectedConfigurationId === configurationId
          ? null
          : deps.documents.getConfigDocument().selectedConfigurationId,
    });
    deps.documents.setSecretsDocument({
      ...deps.documents.getSecretsDocument(),
      bindings: retainedBindings,
    });
    const persisted = await deps.documents.writeDocuments();
    if (!persisted.ok) return persisted;

    const undeleted = await deps.deleteRetiredSecretMaterial(bindingsToDelete, retainedBindings);
    if (undeleted.length > 0) {
      deps.documents.setConfigDocument(configBeforeDelete);
      deps.documents.setSecretsDocument(secretsBeforeDelete);
      deps.documents.reloadEvidence();
      const rollback = await deps.documents.writeDocuments();
      if (!rollback.ok) return rollback;
      return err(
        configurationActionFailure(
          "SECRET_BINDING_FAILED",
          "Credential material could not be removed",
        ),
      );
    }
    deps.documents.clearConfigurationEvidence(configurationId);
    return ok(succeededActionResponse("delete"));
  };

  const runDeleteAction = async (
    action: Extract<ClientConfigurationAction, { action: "delete" }>,
  ): Promise<Result<ClientConfigurationActionResponse, ConfigurationActionError>> => {
    const configurationId = action.configurationId;
    const leaseHooks = getConfigSeams().leaseHooks;
    if (!leaseHooks) {
      log("error", "configuration_lease_hooks_not_registered");
      return err(
        configurationActionFailure(
          "SECRET_BINDING_FAILED",
          "Reviews using this configuration cannot be checked, so it was not deleted",
        ),
      );
    }
    const deletable = await deps.documents.runMutation(async () => assertDeletable(action));
    if (!deletable.ok) return deletable;

    // A live review can hold its lease for the whole admitted wall time, so the
    // drain runs with the documents unlocked: every readiness read, settings
    // read and other configuration action keeps moving meanwhile. Revocation is
    // already in force, so no new lease can be granted before the write below.
    try {
      await leaseHooks.revoke(configurationId);
      await leaseHooks.cancel(configurationId);
      await leaseHooks.drain(configurationId);
    } catch (cause) {
      await leaseHooks.clearRevocation(configurationId);
      log("warn", "configuration_lease_release_failed", { error: getErrorMessage(cause) });
      return err(
        configurationActionFailure(
          "CONFIGURATION_CONFLICT",
          "A review is still running on this configuration",
        ),
      );
    }

    const deleted = await deps.documents.runMutation(() => commitDelete(action));
    // A configuration that survives a failed delete must admit reviews again;
    // otherwise it stays visible and ready while every review is refused.
    if (!deleted.ok) await leaseHooks.clearRevocation(configurationId);
    return deleted;
  };

  return { runCreateAction, runInspectAction, runSelectAction, runUpdateAction, runDeleteAction };
}
