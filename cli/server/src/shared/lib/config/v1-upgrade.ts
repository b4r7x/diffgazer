import { createError } from "@diffgazer/core/errors";
import { isModelIdAllowedForProduct, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  ExactModelIdSchema,
  type LegacyProviderConfigV1,
  type RunnableProductId,
} from "@diffgazer/core/schemas/config";
import type { DecodedSecretBinding, SecretsDocumentV2 } from "./persistence/secrets.js";
import { SECRETS_SCHEMA_VERSION_V2 } from "./persistence/secrets.js";
import {
  type ConfigurationBudgetLimits,
  type DecodedProviderConfigurationRecord,
  NonSecretTransportInputSchema,
  type SupportedProviderConfigurationRecord,
} from "./provider-config.js";
import type { SecretBinding } from "./secret-bindings.js";
import {
  type LegacySecretConfiguration,
  preflightV1SecretsMigration,
  transferV1Credentials,
  type V1CredentialTransfer,
  type V1SecretsStorage,
} from "./secrets-migration.js";
import {
  CONFIG_SCHEMA_VERSION_V2,
  type ConfigDocumentV1,
  type ConfigDocumentV2,
  type SecretsState,
  type SecretsStorageError,
  V1_MIGRATION_FAILED_MESSAGE,
} from "./types.js";

export interface V1UpgradeOptions {
  /** Budget applied to every upgraded record; V1 documents carry no limits. */
  readonly budget: ConfigurationBudgetLimits;
}

export interface V1UpgradeResult {
  readonly configDocument: ConfigDocumentV2;
  readonly secretsDocument: SecretsDocumentV2;
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
  let selectedModelId: string | null = null;
  if (model !== undefined) {
    // A stored model current policy no longer accepts — a `-latest` alias, a
    // retired id — is dropped rather than failing the upgrade: the record lands
    // in the "pick a model" state instead of stranding the whole configuration
    // and its credential in V1.
    const parsedModel = ExactModelIdSchema.safeParse(model);
    if (parsedModel.success && isModelIdAllowedForProduct(productId, parsedModel.data)) {
      selectedModelId = parsedModel.data;
    }
  }

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
    acknowledgement: {
      noticeId: product.notice.id,
      noticeVersion: product.notice.noticeVersion,
      acceptedAt: null,
    },
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

interface V1UpgradePlan {
  readonly bindings: readonly SecretBinding[];
  readonly transfers: readonly V1CredentialTransfer[];
  readonly records: readonly DecodedProviderConfigurationRecord[];
  readonly selectedConfigurationId: string | null;
}

const migrationFailure = (): Result<never, SecretsStorageError> =>
  err(createError("SECRETS_MIGRATION_FAILED", V1_MIGRATION_FAILED_MESSAGE));

/** An unset V1 storage setting kept literals in `secrets.json`, the same as `file`. */
const resolveV1SecretsStorage = (
  settings: Readonly<Record<string, unknown>>,
): Result<V1SecretsStorage, SecretsStorageError> => {
  const stored = settings.secretsStorage;
  if (stored === "keyring") return ok("keyring");
  if (stored === undefined || stored === null || stored === "file") return ok("file");
  return migrationFailure();
};

const buildV1UpgradePlan = (
  configV1: ConfigDocumentV1,
  secretsV1: SecretsState,
  now: string,
  options: V1UpgradeOptions,
): Result<V1UpgradePlan, SecretsStorageError> => {
  const storage = resolveV1SecretsStorage(configV1.settings);
  if (!storage.ok) return storage;
  const records: DecodedProviderConfigurationRecord[] = [];
  const legacyConfigurations: LegacySecretConfiguration[] = [];
  const activeConfigurationIds: string[] = [];
  const retiredProviders = new Set<string>();

  for (const entry of configV1.providers) {
    if (entry.status === "unknown") return migrationFailure();
    const productId = upgradableProductId(entry.record.provider);
    if (!productId) {
      // A retired legacy provider has no V2 product to upgrade into. Dropping
      // the entry (and its secret) lets still-supported siblings migrate
      // instead of stranding the whole document in V1.
      retiredProviders.add(entry.record.provider);
      continue;
    }
    const record = upgradeRunnableRecord(entry.record, productId, now, options);
    if (!record) return migrationFailure();
    records.push({ status: "supported", record, rawBytes: encodeJsonBytes(record) });
    legacyConfigurations.push({
      provider: entry.record.provider,
      configurationId: record.configurationId,
      revision: 1,
      hasApiKey: entry.record.hasApiKey,
    });
    if (entry.record.isActive) activeConfigurationIds.push(record.configurationId);
  }

  if (activeConfigurationIds.length > 1) return migrationFailure();
  const configuredProviders = new Set(legacyConfigurations.map((entry) => entry.provider));
  const migratableSecrets: SecretsState = {
    providers: Object.fromEntries(
      Object.entries(secretsV1.providers).filter(([provider]) => !retiredProviders.has(provider)),
    ),
  };
  if (
    Object.keys(migratableSecrets.providers).some((provider) => !configuredProviders.has(provider))
  ) {
    return migrationFailure();
  }
  const secretPreflight = preflightV1SecretsMigration(
    migratableSecrets,
    legacyConfigurations,
    storage.value,
  );
  if (!secretPreflight.ok) return secretPreflight;

  return ok({
    bindings: secretPreflight.value.bindings,
    transfers: secretPreflight.value.transfers,
    records,
    selectedConfigurationId: activeConfigurationIds[0] ?? null,
  });
};

export function preflightV1Documents(
  configV1: ConfigDocumentV1,
  secretsV1: SecretsState,
  options: V1UpgradeOptions,
): Result<void, SecretsStorageError> {
  const plan = buildV1UpgradePlan(configV1, secretsV1, "1970-01-01T00:00:00.000Z", options);
  return plan.ok ? ok(undefined) : plan;
}

/**
 * One-way upgrade of representable provider-keyed V1 data to configuration-keyed
 * V2 documents. Environment references and explicit no-secret records migrate as
 * metadata; a literal secret is copied to its V2 destination only after the whole
 * document passes preflight, and the V1 source stays readable until the caller
 * commits the returned documents.
 *
 * Entries naming a retired legacy provider are dropped together with their
 * secrets; the remaining inputs that cannot be represented losslessly stay V1
 * and require manual intervention.
 */
export async function upgradeV1Documents(
  configV1: ConfigDocumentV1,
  secretsV1: SecretsState,
  options: V1UpgradeOptions,
): Promise<Result<V1UpgradeResult, SecretsStorageError>> {
  const now = new Date().toISOString();
  const plan = buildV1UpgradePlan(configV1, secretsV1, now, options);
  if (!plan.ok) return plan;
  const transferred = await transferV1Credentials(plan.value.transfers);
  if (!transferred.ok) return transferred;

  const configDocument: ConfigDocumentV2 = {
    schemaVersion: CONFIG_SCHEMA_VERSION_V2,
    settings: configV1.settings,
    selectedConfigurationId: plan.value.selectedConfigurationId,
    configurations: plan.value.records,
  };
  return ok({
    configDocument,
    secretsDocument: bindingsDocument(plan.value.bindings),
  });
}
