import { z } from "zod";
import {
  type ClientConfigurationActionName,
  ClientConfigurationActionNameSchema,
  type ClientConfigurationNotice,
  ClientConfigurationNoticeSchema,
  type ClientConfigurationSummary,
  ClientConfigurationSummarySchema,
  ExactModelIdSchema,
} from "../schemas/config/provider-config.js";
import {
  type Readiness,
  type ReadinessAcknowledgement,
  ReadinessSchema,
} from "../schemas/config/readiness.js";
import {
  matchesHostedApiTransportTuple,
  matchesLocalHttpTransportTuple,
  type RunnableProductId,
  RunnableProductIdSchema,
} from "../schemas/config/transports.js";
import {
  isModelIdAllowedForProduct,
  type ModelPolicy,
  PRODUCT_REGISTRY,
  type ProductNotice,
} from "./product-registry.js";

const ConfigurationFieldSchema = z.enum([
  "credential",
  "region",
  "workspace",
  "endpoint",
  "local-authentication",
  "installation",
]);

const BillingModeSchema = z.enum([
  "free-tier",
  "pay-as-you-go",
  "evaluation",
  "route-specific",
  "local-resource",
  "subscription-credit",
]);

const UNCONFIGURED_ACTIONS = ["create"] as const;
const CONFIGURED_ACTIONS = ["inspect", "select", "test", "update", "delete"] as const;
const LOCAL_HTTP_ONLY_READINESS = new Set<Readiness["status"]>([
  "local-endpoint-unreachable",
  "local-endpoint-forbidden",
  "local-api-incompatible",
  "local-no-review-capable-model",
  "local-selected-model-missing",
]);

const ClientEndpointProfileSchema = z.strictObject({
  id: z.string().min(1),
  label: z.string().min(1),
  endpoint: z.string().min(1),
  region: z.string().min(1).optional(),
  workspaceRequired: z.literal(true).optional(),
});

const ClientModelPolicySchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("discovered-exact"),
    suggestedModelId: z.string().min(1).optional(),
    explicitOptInSuffixes: z.array(z.string().min(1)).optional(),
    aliases: z.literal("forbidden"),
  }),
  z.strictObject({
    kind: z.literal("discovered-allowlist"),
    modelIds: z.array(z.string().min(1)),
    suggestedModelId: z.string().min(1).optional(),
    higherCostModelIds: z.array(z.string().min(1)).optional(),
    higherCostModelEvidence: z
      .strictObject({
        outputLimit: z.literal("required"),
        reviewConformance: z.literal("required"),
      })
      .optional(),
    aliases: z.literal("forbidden"),
  }),
  z.strictObject({
    kind: z.literal("discovered-family"),
    familyPrefixes: z.array(z.string().min(1)),
    rejectedAliases: z.array(z.string().min(1)),
    aliases: z.literal("forbidden"),
  }),
  z.strictObject({
    kind: z.literal("pinned-downstream-route"),
    routePolicy: z.literal("pinned"),
    automaticRouting: z.literal("forbidden"),
    aliases: z.literal("forbidden"),
  }),
]);

const ClientRunnableProductSchema = z.strictObject({
  productId: RunnableProductIdSchema,
  status: z.literal("supported"),
  selectable: z.literal(true),
  transportFamily: z.enum(["hosted-api", "local-http", "local-cli"]),
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

export const ClientProductMetadataSchema = ClientRunnableProductSchema.superRefine(
  (product, context) => {
    if (JSON.stringify(product) !== JSON.stringify(buildClientProduct(product.productId))) {
      context.addIssue({
        code: "custom",
        message: "Product metadata must match the product registry projection",
      });
    }
  },
);
export type ClientProductMetadata = z.infer<typeof ClientProductMetadataSchema>;

const ClientMetadataPayloadShapeSchema = z.strictObject({
  product: ClientProductMetadataSchema,
  configuration: ClientConfigurationSummarySchema.nullable(),
  readiness: ReadinessSchema,
  notices: z.array(ClientConfigurationNoticeSchema),
  actions: z.array(ClientConfigurationActionNameSchema),
});
type ClientMetadataPayloadShape = z.infer<typeof ClientMetadataPayloadShapeSchema>;

function matchesActions(
  actual: readonly ClientConfigurationActionName[],
  expected: readonly ClientConfigurationActionName[],
): boolean {
  return (
    actual.length === expected.length && actual.every((action, index) => action === expected[index])
  );
}

function isLatestAlias(modelId: string): boolean {
  return modelId.split(/[./:_-]/).some((segment) => segment.toLowerCase() === "latest");
}

function isEligibleReadyModelId(modelId: string, productId: RunnableProductId): boolean {
  if (!ExactModelIdSchema.safeParse(modelId).success || isLatestAlias(modelId)) return false;
  return isModelIdAllowedForProduct(productId, modelId);
}

function validateReadyClaims(
  productId: RunnableProductId,
  configuration: ClientConfigurationSummary,
  readiness: Readiness,
  context: z.RefinementCtx<ClientMetadataPayloadShape>,
): void {
  if (readiness.status !== "ready") return;

  if (!readiness.ready || readiness.evidenceStatus !== "passed" || readiness.checkedAt === null) {
    context.addIssue({
      code: "custom",
      message: "Ready metadata requires passed evidence with a checked timestamp",
      path: ["readiness"],
    });
  }

  const selectedModelId = configuration.selectedModelId;
  if (selectedModelId === null || !isEligibleReadyModelId(selectedModelId, productId)) {
    context.addIssue({
      code: "custom",
      message: "Ready metadata requires an eligible exact selected model",
      path: ["configuration", "selectedModelId"],
    });
  }

  const acknowledgement = readiness.acknowledgement;
  const notice = PRODUCT_REGISTRY[productId].notice;
  if (
    acknowledgement.status !== "accepted" ||
    acknowledgement.noticeId !== notice.id ||
    acknowledgement.noticeVersion !== notice.noticeVersion
  ) {
    context.addIssue({
      code: "custom",
      message: "Ready metadata requires acknowledgement of the current product notice",
      path: ["readiness", "acknowledgement"],
    });
  }
}

/**
 * A non-ready state may still carry an acknowledgement observed while the
 * configuration was tested (for example a failed or intentionally skipped
 * probe).  The acknowledgement is client-safe only when it refers to the
 * notice owned by the projected product.  `not-applicable` is retained for
 * states that cannot carry terms (unsupported and early failures), while every
 * required or accepted acknowledgement is bound to the current product notice.
 */
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

  if (JSON.stringify(notices) !== JSON.stringify([product.notice])) {
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
    if (!matchesProductEndpoint(configuration)) {
      context.addIssue({
        code: "custom",
        message: "Configuration endpoint must match the product registry projection",
        path: ["configuration"],
      });
    }
    if (!matchesActions(actions, configuration.availableActions)) {
      context.addIssue({
        code: "custom",
        message: "Payload actions do not match the configuration",
        path: ["actions"],
      });
    }
    if (JSON.stringify(notices) !== JSON.stringify(configuration.notices)) {
      context.addIssue({
        code: "custom",
        message: "Payload notices do not match the configuration",
        path: ["notices"],
      });
    }
  }

  validateAcknowledgementClaims(product.productId, readiness, context);

  if (product.transportFamily === "hosted-api" && readiness.status.startsWith("local-")) {
    context.addIssue({
      code: "custom",
      message: "Hosted products cannot report local readiness",
      path: ["readiness", "status"],
    });
  }
  if (product.transportFamily === "local-cli" && LOCAL_HTTP_ONLY_READINESS.has(readiness.status)) {
    context.addIssue({
      code: "custom",
      message: "Local CLI products cannot report HTTP readiness",
      path: ["readiness", "status"],
    });
  }

  if (!configuration) {
    if (readiness.status !== "unconfigured" || !matchesActions(actions, UNCONFIGURED_ACTIONS)) {
      context.addIssue({
        code: "custom",
        message: "An unconfigured product allows only creation",
        path: ["actions"],
      });
    }
    return;
  }

  if (readiness.status === "unconfigured") {
    context.addIssue({
      code: "custom",
      message: "Configured products cannot be unconfigured",
      path: ["readiness", "status"],
    });
  }
  if (!matchesActions(actions, CONFIGURED_ACTIONS)) {
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

  validateReadyClaims(product.productId, configuration, readiness, context);
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

function toClientNotice(notice: ProductNotice | ClientConfigurationNotice) {
  return ClientConfigurationNoticeSchema.parse({
    id: notice.id,
    noticeVersion: notice.noticeVersion,
    acknowledgement: notice.acknowledgement,
    acknowledgeBefore: notice.acknowledgeBefore,
    renewAcknowledgementOn: notice.renewAcknowledgementOn,
    billing: [...notice.billing],
    privacy: [...notice.privacy],
  });
}

function toClientModelPolicy(modelPolicy: ModelPolicy) {
  switch (modelPolicy.kind) {
    case "discovered-exact":
      return ClientModelPolicySchema.parse({
        kind: modelPolicy.kind,
        suggestedModelId: modelPolicy.suggestedModelId,
        explicitOptInSuffixes: modelPolicy.explicitOptInSuffixes,
        aliases: modelPolicy.aliases,
      });
    case "discovered-allowlist":
      return ClientModelPolicySchema.parse({
        kind: modelPolicy.kind,
        modelIds: [...modelPolicy.modelIds],
        suggestedModelId: modelPolicy.suggestedModelId,
        higherCostModelIds: modelPolicy.higherCostModelIds,
        higherCostModelEvidence: modelPolicy.higherCostModelEvidence,
        aliases: modelPolicy.aliases,
      });
    case "discovered-family":
      return ClientModelPolicySchema.parse({
        kind: modelPolicy.kind,
        familyPrefixes: [...modelPolicy.familyPrefixes],
        rejectedAliases: [...modelPolicy.rejectedAliases],
        aliases: modelPolicy.aliases,
      });
    case "pinned-downstream-route":
      return ClientModelPolicySchema.parse({
        kind: modelPolicy.kind,
        routePolicy: modelPolicy.routePolicy,
        automaticRouting: modelPolicy.automaticRouting,
        aliases: modelPolicy.aliases,
      });
  }
}

function buildClientProduct(productId: RunnableProductId) {
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
      region: "region" in endpoint ? endpoint.region : undefined,
      workspaceRequired: "workspaceBound" in endpoint ? endpoint.workspaceBound : undefined,
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

function toClientConfiguration(configuration: ClientConfigurationSummary | null) {
  if (!configuration) return null;

  const base = {
    configurationId: configuration.configurationId,
    revision: configuration.revision,
    status: configuration.status,
    transportFamily: configuration.transportFamily,
    productId: configuration.productId,
    selectedModelId: configuration.selectedModelId,
    notices: configuration.notices.map(toClientNotice),
    availableActions: [...configuration.availableActions],
  };

  if (configuration.transportFamily === "hosted-api") {
    return ClientConfigurationSummarySchema.parse({
      ...base,
      endpoint: configuration.endpoint,
      region: configuration.region,
      workspace: configuration.workspace,
    });
  }
  if (configuration.transportFamily === "local-http") {
    return ClientConfigurationSummarySchema.parse({
      ...base,
      endpoint: configuration.endpoint,
      authentication: configuration.authentication,
      presetId: configuration.presetId,
    });
  }
  return ClientConfigurationSummarySchema.parse({
    ...base,
    installationId: configuration.installationId,
  });
}

function matchesProductEndpoint(configuration: ClientConfigurationSummary): boolean {
  const product = PRODUCT_REGISTRY[configuration.productId];
  if (product.transportFamily !== configuration.transportFamily) {
    return false;
  }

  if (configuration.transportFamily === "hosted-api") {
    return matchesHostedApiTransportTuple(configuration);
  }

  if (configuration.transportFamily === "local-http") {
    return matchesLocalHttpTransportTuple(configuration);
  }

  return true;
}

function toClientAcknowledgement(acknowledgement: ReadinessAcknowledgement) {
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

function toClientReadiness(readiness: Readiness) {
  return ReadinessSchema.parse({
    status: readiness.status,
    ready: readiness.ready,
    evidenceStatus: readiness.evidenceStatus,
    checkedAt: readiness.checkedAt,
    acknowledgement: toClientAcknowledgement(readiness.acknowledgement),
    action: readiness.action,
    explanation: readiness.explanation,
    remediation: {
      code: readiness.remediation.code,
      message: readiness.remediation.message,
    },
  });
}

export function projectClientMetadata(source: ClientMetadataSource): ClientMetadataPayload {
  return ClientMetadataPayloadSchema.parse({
    product: projectClientProduct(source.productId),
    configuration: toClientConfiguration(source.configuration),
    readiness: toClientReadiness(source.readiness),
    notices: source.notices.map(toClientNotice),
    actions: [...source.actions],
  });
}
