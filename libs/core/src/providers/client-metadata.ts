import { z } from "zod";
import { refineConfigurationReadinessConsistency } from "../schemas/config/configuration-readiness-consistency.js";
import {
  type ClientConfigurationActionName,
  ClientConfigurationActionNameSchema,
  type ClientConfigurationNotice,
  ClientConfigurationNoticeSchema,
  type ClientConfigurationSummary,
  ClientConfigurationSummarySchema,
} from "../schemas/config/provider-config.js";
import {
  type Readiness,
  type ReadinessAcknowledgement,
  ReadinessSchema,
} from "../schemas/config/readiness.js";
import {
  type RunnableProductId,
  RunnableProductIdSchema,
  TransportFamilySchema,
} from "../schemas/config/transports.js";
import { BILLING_MODES, CONFIGURATION_FIELDS, type ModelPolicy } from "./model-policy.js";
import { PRODUCT_REGISTRY, type ProductNotice } from "./product-registry.js";

// Derived from the product-registry vocabularies so a new canonical member
// fails to compile here instead of throwing at projection.
const ConfigurationFieldSchema = z.enum(CONFIGURATION_FIELDS);
const BillingModeSchema = z.enum(BILLING_MODES);

const UNCONFIGURED_ACTIONS = ["create"] as const;
const CONFIGURED_ACTIONS = ["inspect", "select", "test", "update", "delete"] as const;

const ClientEndpointProfileSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  endpoint: z.string().min(1),
});

const ClientModelPolicySchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("discovered-exact"),
    suggestedModelId: z.string().min(1).optional(),
    aliases: z.literal("forbidden"),
  }),
  z.strictObject({
    kind: z.literal("discovered-allowlist"),
    modelIds: z.array(z.string().min(1)),
    suggestedModelId: z.string().min(1).optional(),
    higherCostModelIds: z.array(z.string().min(1)).optional(),
    aliases: z.literal("forbidden"),
  }),
  z.strictObject({
    kind: z.literal("pinned-downstream-route"),
    routePolicy: z.literal("pinned"),
    automaticRouting: z.literal("forbidden"),
    aliases: z.literal("forbidden"),
  }),
]);

export const ClientProductMetadataSchema = z.strictObject({
  productId: RunnableProductIdSchema,
  status: z.literal("supported"),
  selectable: z.literal(true),
  transportFamily: TransportFamilySchema,
  name: z.string().min(1),
  description: z.string().min(1),
  setupLabel: z.string().min(1),
  setupFields: z.array(ConfigurationFieldSchema),
  endpoints: z.array(ClientEndpointProfileSchema),
  customLoopbackEndpoint: z.literal(true).optional(),
  modelPolicy: ClientModelPolicySchema,
  billing: z.strictObject({
    modes: z.array(BillingModeSchema),
    posture: z.string().min(1),
  }),
  notice: ClientConfigurationNoticeSchema,
});

export type ClientProductMetadata = z.infer<typeof ClientProductMetadataSchema>;

const ClientMetadataPayloadShapeSchema = z.strictObject({
  product: ClientProductMetadataSchema,
  configuration: ClientConfigurationSummarySchema.nullable(),
  readiness: ReadinessSchema,
  notices: z.array(ClientConfigurationNoticeSchema),
  actions: z.array(ClientConfigurationActionNameSchema),
});
type ClientMetadataPayloadShape = z.infer<typeof ClientMetadataPayloadShapeSchema>;

function matchesList(actual: readonly string[], expected: readonly string[]): boolean {
  return (
    actual.length === expected.length && actual.every((value, index) => value === expected[index])
  );
}

// The remaining notice fields are single-valued literals in
// `ClientConfigurationNoticeSchema`, so identity plus copy is the whole notice.
function matchesNotices(
  actual: readonly ClientConfigurationNotice[],
  expected: readonly ClientConfigurationNotice[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((notice, index) => {
      const other = expected[index];
      return (
        other !== undefined &&
        notice.id === other.id &&
        notice.noticeVersion === other.noticeVersion &&
        matchesList(notice.billing, other.billing) &&
        matchesList(notice.privacy, other.privacy)
      );
    })
  );
}

function validateAcknowledgementClaims(
  productId: RunnableProductId,
  readiness: Readiness,
  context: z.RefinementCtx<ClientMetadataPayloadShape>,
): void {
  const acknowledgement = readiness.acknowledgement;
  if (acknowledgement.status === "not-applicable") return;

  const notice = PRODUCT_REGISTRY[productId].notice;
  if (
    acknowledgement.noticeId !== notice.id ||
    acknowledgement.noticeVersion !== notice.noticeVersion
  ) {
    context.addIssue({
      code: "custom",
      message: "Readiness acknowledgement must match the current product notice",
      path: ["readiness", "acknowledgement"],
    });
  }
}

function validatePayloadConsistency(
  payload: ClientMetadataPayloadShape,
  context: z.RefinementCtx<ClientMetadataPayloadShape>,
): void {
  const { actions, configuration, notices, product, readiness } = payload;

  if (!matchesNotices(notices, [product.notice])) {
    context.addIssue({
      code: "custom",
      message: "Payload notices must match the product registry projection",
      path: ["notices"],
    });
  }

  if (configuration) {
    if (configuration.productId !== product.productId) {
      context.addIssue({
        code: "custom",
        message: "Configuration product does not match",
        path: ["configuration", "productId"],
      });
    }
    if (configuration.transportFamily !== product.transportFamily) {
      context.addIssue({
        code: "custom",
        message: "Configuration transport does not match",
        path: ["configuration", "transportFamily"],
      });
    }
    if (!matchesList(actions, configuration.availableActions)) {
      context.addIssue({
        code: "custom",
        message: "Payload actions do not match the configuration",
        path: ["actions"],
      });
    }
    if (!matchesNotices(notices, configuration.notices)) {
      context.addIssue({
        code: "custom",
        message: "Payload notices do not match the configuration",
        path: ["notices"],
      });
    }

    refineConfigurationReadinessConsistency({ configuration, readiness }, context);
  }

  if (!configuration) {
    validateAcknowledgementClaims(product.productId, readiness, context);
    if (readiness.status !== "unconfigured" || !matchesList(actions, UNCONFIGURED_ACTIONS)) {
      context.addIssue({
        code: "custom",
        message: "An unconfigured product allows only creation",
        path: ["actions"],
      });
    }
    return;
  }

  if (!matchesList(actions, CONFIGURED_ACTIONS)) {
    context.addIssue({
      code: "custom",
      message: "Supported configurations must expose the configured action contract",
      path: ["actions"],
    });
  }
  if (!actions.includes(readiness.action)) {
    context.addIssue({
      code: "custom",
      message: "Readiness action is not available",
      path: ["readiness", "action"],
    });
  }
}

export const ClientMetadataPayloadSchema = ClientMetadataPayloadShapeSchema.superRefine(
  validatePayloadConsistency,
);
export type ClientMetadataPayload = z.infer<typeof ClientMetadataPayloadSchema>;

export interface ClientMetadataSource {
  readonly productId: RunnableProductId;
  readonly configuration: ClientConfigurationSummary | null;
  readonly readiness: Readiness;
  readonly notices: readonly (ProductNotice | ClientConfigurationNotice)[];
  readonly actions: readonly ClientConfigurationActionName[];
}

function toClientNotice(
  notice: ProductNotice | ClientConfigurationNotice,
): ClientConfigurationNotice {
  return {
    id: notice.id,
    noticeVersion: notice.noticeVersion,
    acknowledgement: notice.acknowledgement,
    acknowledgeBefore: notice.acknowledgeBefore,
    renewAcknowledgementOn: notice.renewAcknowledgementOn,
    billing: [...notice.billing],
    privacy: [...notice.privacy],
  };
}

function toClientModelPolicy(modelPolicy: ModelPolicy): ClientProductMetadata["modelPolicy"] {
  switch (modelPolicy.kind) {
    case "discovered-exact":
      return {
        kind: modelPolicy.kind,
        suggestedModelId: modelPolicy.suggestedModelId,
        aliases: modelPolicy.aliases,
      };
    case "discovered-allowlist":
      return {
        kind: modelPolicy.kind,
        modelIds: [...modelPolicy.modelIds],
        suggestedModelId: modelPolicy.suggestedModelId,
        higherCostModelIds: modelPolicy.higherCostModelIds
          ? [...modelPolicy.higherCostModelIds]
          : undefined,
        aliases: modelPolicy.aliases,
      };
    case "pinned-downstream-route":
      return {
        kind: modelPolicy.kind,
        routePolicy: modelPolicy.routePolicy,
        automaticRouting: modelPolicy.automaticRouting,
        aliases: modelPolicy.aliases,
      };
  }
}

function buildClientProduct(productId: RunnableProductId): ClientProductMetadata {
  const product = PRODUCT_REGISTRY[productId];

  return {
    productId: product.id,
    status: "supported",
    selectable: product.selectable,
    transportFamily: product.transportFamily,
    name: product.presentation.name,
    description: product.presentation.description,
    setupLabel: product.presentation.setupLabel,
    setupFields: [...product.configuration.fields],
    endpoints: product.configuration.endpoints.map((endpoint) => ({
      id: endpoint.id,
      label: endpoint.label,
      endpoint: endpoint.endpoint,
    })),
    customLoopbackEndpoint:
      "customLoopbackEndpoint" in product.configuration
        ? product.configuration.customLoopbackEndpoint
        : undefined,
    modelPolicy: toClientModelPolicy(product.modelPolicy),
    billing: {
      modes: [...product.billing.modes],
      posture: product.billing.posture,
    },
    notice: toClientNotice(product.notice),
  };
}

export function projectClientProduct(productId: RunnableProductId): ClientProductMetadata {
  return ClientProductMetadataSchema.parse(buildClientProduct(productId));
}

function toClientConfiguration(
  configuration: ClientConfigurationSummary | null,
): ClientConfigurationSummary | null {
  if (!configuration) return null;

  if (configuration.transportFamily === "hosted-api") {
    return {
      configurationId: configuration.configurationId,
      revision: configuration.revision,
      status: configuration.status,
      transportFamily: configuration.transportFamily,
      productId: configuration.productId,
      endpoint: configuration.endpoint,
      selectedModelId: configuration.selectedModelId,
      notices: configuration.notices.map(toClientNotice),
      availableActions: [...configuration.availableActions],
    };
  }
  if (configuration.transportFamily === "local-http") {
    return {
      configurationId: configuration.configurationId,
      revision: configuration.revision,
      status: configuration.status,
      transportFamily: configuration.transportFamily,
      productId: configuration.productId,
      endpoint: configuration.endpoint,
      authentication: configuration.authentication,
      presetId: configuration.presetId,
      selectedModelId: configuration.selectedModelId,
      notices: configuration.notices.map(toClientNotice),
      availableActions: [...configuration.availableActions],
    };
  }
  return {
    configurationId: configuration.configurationId,
    revision: configuration.revision,
    status: configuration.status,
    transportFamily: configuration.transportFamily,
    productId: configuration.productId,
    installationId: configuration.installationId,
    selectedModelId: configuration.selectedModelId,
    notices: configuration.notices.map(toClientNotice),
    availableActions: [...configuration.availableActions],
  };
}

function toClientAcknowledgement(
  acknowledgement: ReadinessAcknowledgement,
): ReadinessAcknowledgement {
  if (acknowledgement.status === "not-applicable") return { status: acknowledgement.status };
  if (acknowledgement.status === "required") {
    return {
      status: acknowledgement.status,
      noticeId: acknowledgement.noticeId,
      noticeVersion: acknowledgement.noticeVersion,
    };
  }
  return {
    status: acknowledgement.status,
    noticeId: acknowledgement.noticeId,
    noticeVersion: acknowledgement.noticeVersion,
    acceptedAt: acknowledgement.acceptedAt,
  };
}

/**
 * Names every field the client may see, so a server-only one added to
 * `Readiness` upstream is dropped here instead of reaching the wire. Assembling
 * the fields one by one decorrelates them from the status, so the assertion puts
 * `Readiness` back on the return rather than handing callers a bag of every
 * branch's keys.
 */
function toClientReadiness(readiness: Readiness): Readiness {
  return {
    status: readiness.status,
    ready: readiness.ready,
    evidenceStatus: readiness.evidenceStatus,
    checkedAt: readiness.checkedAt,
    acknowledgement: toClientAcknowledgement(readiness.acknowledgement),
    action: readiness.action,
    explanation: readiness.explanation,
    // Copied as a pair: splitting code from message decorrelates the literals
    // `ReadinessSchema` ties to the status.
    remediation: readiness.remediation,
  } as Readiness;
}

export function projectClientMetadata(source: ClientMetadataSource): ClientMetadataPayload {
  return ClientMetadataPayloadSchema.parse({
    product: buildClientProduct(source.productId),
    configuration: toClientConfiguration(source.configuration),
    readiness: toClientReadiness(source.readiness),
    notices: source.notices.map(toClientNotice),
    actions: [...source.actions],
  });
}
