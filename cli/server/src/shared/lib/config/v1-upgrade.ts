import { isModelIdAllowedForProduct, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { ok, type Result } from "@diffgazer/core/result";
import {
  ExactModelIdSchema,
  type LegacyProviderConfigV1,
  type RunnableProductId,
  type SecretsStorage,
} from "@diffgazer/core/schemas/config";
import { log } from "../log.js";
import type { DecodedSecretBinding, SecretsDocumentV2 } from "./persistence/secrets.js";
import { SECRETS_SCHEMA_VERSION_V2 } from "./persistence/secrets.js";
import {
  type ConfigurationBudgetLimits,
  type DecodedProviderConfigurationRecord,
  NonSecretTransportInputSchema,
  type SupportedProviderConfigurationRecord,
} from "./provider-config.js";
import type { SecretBinding } from "./secret-bindings.js";
import { type LegacySecretConfiguration, migrateV1SecretsToBindings } from "./secrets-migration.js";
import {
  CONFIG_SCHEMA_VERSION_V2,
  type ConfigDocumentV1,
  type ConfigDocumentV2,
  type SecretsState,
  type SecretsStorageError,
} from "./types.js";

export interface V1UpgradeOptions {
  /** Budget applied to every upgraded record; V1 documents carry no limits. */
  readonly budget: ConfigurationBudgetLimits;
  readonly filePathFor: (identity: {
    readonly configurationId: string;
    readonly revision: number;
  }) => string;
}

export interface V1UpgradeResult {
  readonly configDocument: ConfigDocumentV2;
  readonly secretsDocument: SecretsDocumentV2;
  /** Provider-keyed keyring entries superseded by configuration-keyed ones. */
  readonly keyringDeletions: readonly string[];
}

const textEncoder = new TextEncoder();
const encodeJsonBytes = (value: unknown): Uint8Array => textEncoder.encode(JSON.stringify(value));

/** V1 ids are opaque strings; only a registered hosted-api product can execute. */
const upgradableProductId = (provider: string): RunnableProductId | null => {
  const product = PRODUCT_REGISTRY[provider as RunnableProductId] as
    | (typeof PRODUCT_REGISTRY)[RunnableProductId]
    | undefined;
  if (!product || product.transportFamily !== "hosted-api") {
    return null;
  }
  return product.id;
};

const upgradedConfigurationId = (provider: string): string => `cfg-v1-${provider}`;

/**
 * A V1 entry names a provider and at most a model. The endpoint, budget, and
 * notice acknowledgement have no V1 equivalent, so the upgrade adopts the
 * product's first registered endpoint, the caller's default budget, and an
 * unaccepted acknowledgement. Evidence is never carried: the upgraded record is
 * conformance-pending until the user runs a test.
 */
const upgradeRunnableRecord = (
  record: LegacyProviderConfigV1,
  productId: RunnableProductId,
  now: string,
  options: V1UpgradeOptions,
): SupportedProviderConfigurationRecord | null => {
  const product = PRODUCT_REGISTRY[productId];
  const endpoint = product.configuration.endpoints?.[0]?.endpoint;
  if (!endpoint) return null;
  const model = record.model;
  const selectedModelId =
    model !== undefined &&
    ExactModelIdSchema.safeParse(model).success &&
    isModelIdAllowedForProduct(productId, model)
      ? model
      : null;

  return {
    schemaVersion: 2,
    status: "supported",
    configurationId: upgradedConfigurationId(record.provider),
    revision: 1,
    transportFamily: "hosted-api",
    productId,
    input: NonSecretTransportInputSchema.parse({
      transportFamily: "hosted-api",
      productId,
      endpoint,
    }),
    selectedModelId,
    acknowledgement: { noticeVersion: product.notice.noticeVersion, acceptedAt: null },
    evidenceReference: null,
    budget: options.budget,
    createdAt: now,
    updatedAt: now,
  };
};

const bindingsDocument = (bindings: readonly SecretBinding[]): SecretsDocumentV2 => ({
  schemaVersion: SECRETS_SCHEMA_VERSION_V2,
  bindings: bindings.map(
    (binding): DecodedSecretBinding => ({
      status: binding.status === "active" ? "supported" : binding.status,
      binding,
      rawBytes: encodeJsonBytes(binding),
    }),
  ),
});

/**
 * One-way upgrade of the provider-keyed V1 pair to the configuration-keyed V2
 * documents. Credentials are copied to their configuration-keyed destination
 * before the caller commits; provider-keyed keyring entries are only deleted
 * after that commit, so an interrupted upgrade is re-runnable.
 *
 * V1 entries this binary cannot interpret carry no resolvable credential and no
 * product identity, so they are dropped rather than invented into a V2 record.
 */
export function upgradeV1Documents(
  configV1: ConfigDocumentV1,
  secretsV1: SecretsState,
  options: V1UpgradeOptions,
): Result<V1UpgradeResult, SecretsStorageError> {
  const storage: Exclude<SecretsStorage, null> =
    configV1.settings.secretsStorage === "keyring" ? "keyring" : "file";
  const now = new Date().toISOString();

  const records: DecodedProviderConfigurationRecord[] = [];
  const legacyConfigurations: LegacySecretConfiguration[] = [];
  let selectedConfigurationId: string | null = null;
  let droppedEntries = 0;

  for (const entry of configV1.providers) {
    if (entry.status === "unknown") {
      droppedEntries += 1;
      continue;
    }

    const productId = upgradableProductId(entry.record.provider);
    const record = productId ? upgradeRunnableRecord(entry.record, productId, now, options) : null;
    if (!record) {
      droppedEntries += 1;
      continue;
    }
    records.push({ status: "supported", record, rawBytes: encodeJsonBytes(record) });
    legacyConfigurations.push({
      provider: entry.record.provider,
      configurationId: record.configurationId,
      revision: 1,
    });
    if (entry.record.isActive) selectedConfigurationId ??= record.configurationId;
  }

  if (droppedEntries > 0) {
    log("warn", "config_v1_entries_dropped", { count: droppedEntries });
  }

  const migrated = migrateV1SecretsToBindings(secretsV1, legacyConfigurations, {
    storage,
    filePathFor: options.filePathFor,
  });
  if (!migrated.ok) return migrated;

  const configDocument: ConfigDocumentV2 = {
    schemaVersion: CONFIG_SCHEMA_VERSION_V2,
    settings: configV1.settings,
    selectedConfigurationId,
    configurations: records,
  };
  return ok({
    configDocument,
    secretsDocument: bindingsDocument(migrated.value.bindings),
    keyringDeletions: migrated.value.keyringDeletions,
  });
}
