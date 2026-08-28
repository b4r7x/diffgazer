import { z } from "zod";
import {
  isModelIdAllowedForProduct,
  PRODUCT_REGISTRY,
  type ProductNotice,
} from "../../providers/product-registry.js";
import {
  type ClientConfigurationNotice,
  ClientConfigurationNoticeSchema,
} from "./configuration-notice.js";
import { AcceptedAcknowledgementSchema, ReadinessSchema } from "./readiness.js";
import {
  getHostedApiEndpointTuple,
  HostedApiEndpointSchema,
  HostedApiProductIdSchema,
  HostedApiTransportInputSchema,
  type RunnableProductId,
} from "./transports.js";

export const CLIENT_CONFIGURATION_ACTIONS = [
  "create",
  "inspect",
  "select",
  "test",
  "update",
  "delete",
] as const;
export const ClientConfigurationActionNameSchema = z.enum(CLIENT_CONFIGURATION_ACTIONS);
export type ClientConfigurationActionName = z.infer<typeof ClientConfigurationActionNameSchema>;

export const ConfigurationIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
export type ConfigurationId = z.infer<typeof ConfigurationIdSchema>;

export const ConfigurationRevisionSchema = z.number().int().positive();
export type ConfigurationRevision = z.infer<typeof ConfigurationRevisionSchema>;

const LATEST_MODEL_ALIAS_PATTERN = /(?:^|[/:._-])latest(?:$|[/:._-])/i;

export const ExactModelIdSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*(?:\/[A-Za-z0-9][A-Za-z0-9._:-]*)?$/)
  .refine(
    (modelId) => !LATEST_MODEL_ALIAS_PATTERN.test(modelId),
    "Marketing aliases are not exact model IDs",
  );
export type ExactModelId = z.infer<typeof ExactModelIdSchema>;

export const WriteOnlySecretInputSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("literal"),
    value: z.string().min(1).max(16_384),
  }),
  z.strictObject({
    kind: z.literal("environment"),
  }),
]);
export type WriteOnlySecretInput = z.infer<typeof WriteOnlySecretInputSchema>;

export const ClientConfigurationInputSchema = HostedApiTransportInputSchema.safeExtend({
  credential: WriteOnlySecretInputSchema.optional(),
});
export type ClientConfigurationInput = z.infer<typeof ClientConfigurationInputSchema>;

// acknowledgement is optional so onboarding can create a draft before the notice step;
// provider setup surfaces send it on create so acceptance is not re-demanded after probe.
const CreateConfigurationActionSchema = z.strictObject({
  action: z.literal("create"),
  input: ClientConfigurationInputSchema,
  acknowledgement: AcceptedAcknowledgementSchema.optional(),
});

const InspectConfigurationActionSchema = z.strictObject({
  action: z.literal("inspect"),
  configurationId: ConfigurationIdSchema,
});

const SelectConfigurationActionSchema = z.strictObject({
  action: z.literal("select"),
  configurationId: ConfigurationIdSchema,
  modelId: ExactModelIdSchema,
});

const TestConfigurationActionSchema = z.strictObject({
  action: z.literal("test"),
  configurationId: ConfigurationIdSchema,
});

const UpdateConfigurationActionSchema = z.strictObject({
  action: z.literal("update"),
  configurationId: ConfigurationIdSchema,
  expectedRevision: ConfigurationRevisionSchema,
  input: ClientConfigurationInputSchema,
  acknowledgement: AcceptedAcknowledgementSchema,
});

// expectedRevision is the revision the client saw. A record this build could not
// decode never showed one, so its delete carries none; the server keeps demanding
// a match for every record it can describe.
const DeleteConfigurationActionSchema = z.strictObject({
  action: z.literal("delete"),
  configurationId: ConfigurationIdSchema,
  expectedRevision: ConfigurationRevisionSchema.optional(),
});

export const ClientConfigurationActionSchema = z.discriminatedUnion("action", [
  CreateConfigurationActionSchema,
  InspectConfigurationActionSchema,
  SelectConfigurationActionSchema,
  TestConfigurationActionSchema,
  UpdateConfigurationActionSchema,
  DeleteConfigurationActionSchema,
]);
export type ClientConfigurationAction = z.infer<typeof ClientConfigurationActionSchema>;

const SupportedConfigurationActionsSchema = z.array(
  z.enum(["inspect", "select", "test", "update", "delete"]),
);

function matchesNotice(notice: ClientConfigurationNotice, expected: ProductNotice): boolean {
  return (
    notice.id === expected.id &&
    notice.noticeVersion === expected.noticeVersion &&
    notice.acknowledgement === expected.acknowledgement &&
    notice.acknowledgeBefore === expected.acknowledgeBefore &&
    notice.renewAcknowledgementOn === expected.renewAcknowledgementOn &&
    notice.billing.length === expected.billing.length &&
    notice.billing.every((line, index) => line === expected.billing[index]) &&
    notice.privacy.length === expected.privacy.length &&
    notice.privacy.every((line, index) => line === expected.privacy[index])
  );
}

function hasCanonicalProductNotice(
  productId: RunnableProductId,
  notices: readonly ClientConfigurationNotice[],
): boolean {
  // A provisional/legacy-safe summary may omit the notice while it is being
  // assembled, but any notice that crosses the client boundary must be the
  // current notice for the bound product.  This prevents relabelling one
  // product's billing/privacy terms as another product's terms.
  if (notices.length === 0) return true;
  const [notice] = notices;
  return (
    notices.length === 1 &&
    notice !== undefined &&
    matchesNotice(notice, PRODUCT_REGISTRY[productId].notice)
  );
}

function hasAllowedSelectedModel(productId: RunnableProductId, modelId: string | null): boolean {
  if (modelId === null) return true;
  return isModelIdAllowedForProduct(productId, modelId);
}

function validateSupportedSummaryBoundary(
  summary: {
    readonly productId: RunnableProductId;
    readonly selectedModelId: string | null;
    readonly notices: readonly ClientConfigurationNotice[];
  },
  context: Pick<z.RefinementCtx<unknown>, "addIssue">,
): void {
  if (!hasCanonicalProductNotice(summary.productId, summary.notices)) {
    context.addIssue({
      code: "custom",
      message: "Configuration notices must match the bound product notice",
      path: ["notices"],
    });
  }

  if (!hasAllowedSelectedModel(summary.productId, summary.selectedModelId)) {
    context.addIssue({
      code: "custom",
      message: "Selected model is not allowed by the bound product policy",
      path: ["selectedModelId"],
    });
  }
}

const ConfigurationSummaryBaseShape = {
  configurationId: ConfigurationIdSchema,
  revision: ConfigurationRevisionSchema,
  selectedModelId: ExactModelIdSchema.nullable(),
  notices: z.array(ClientConfigurationNoticeSchema).max(16),
} as const;

export const ClientConfigurationSummarySchema = z
  .strictObject({
    ...ConfigurationSummaryBaseShape,
    status: z.literal("supported"),
    transportFamily: z.literal("hosted-api"),
    productId: HostedApiProductIdSchema,
    endpoint: HostedApiEndpointSchema,
    availableActions: SupportedConfigurationActionsSchema,
  })
  .superRefine((summary, context) => {
    validateSupportedSummaryBoundary(summary, context);
    if (!getHostedApiEndpointTuple(summary.productId, summary.endpoint)) {
      context.addIssue({
        code: "custom",
        message: "Endpoint must match the selected product",
        path: ["endpoint"],
      });
    }
  });
export type ClientConfigurationSummary = z.infer<typeof ClientConfigurationSummarySchema>;

export const CONFIGURATION_OPERATION_STATUSES = ["succeeded", "failed"] as const;
export const ConfigurationOperationStatusSchema = z.enum(CONFIGURATION_OPERATION_STATUSES);
export type ConfigurationOperationStatus = z.infer<typeof ConfigurationOperationStatusSchema>;

const ConfigurationActionResponseShape = {
  status: ConfigurationOperationStatusSchema,
  configuration: ClientConfigurationSummarySchema.optional(),
  readiness: ReadinessSchema.optional(),
} as const;

/**
 * A succeeded action must carry the summary its own outcome implies: delete
 * leaves nothing behind, and every other action reports the record it acted on.
 * Owning this here keeps the guarantee on the wire contract itself, so both the
 * server that emits a response and the client that parses one fail on the same
 * shape.
 */
function validateSucceededActionConfiguration(
  action: ClientConfigurationActionName,
  configuration: ClientConfigurationSummary | undefined,
  context: Pick<z.RefinementCtx<unknown>, "addIssue">,
): void {
  if (action === "delete") {
    if (configuration) {
      context.addIssue({
        code: "custom",
        message: "A succeeded delete response cannot contain a configuration",
        path: ["configuration"],
      });
    }
    return;
  }

  if (!configuration) {
    context.addIssue({
      code: "custom",
      message: "A succeeded configuration action requires its bound configuration summary",
      path: ["configuration"],
    });
  }
}

function validateActionResponseBinding(
  action: ClientConfigurationActionName,
  response: {
    readonly status: ConfigurationOperationStatus;
    readonly configuration?: ClientConfigurationSummary;
    readonly readiness?: z.infer<typeof ReadinessSchema>;
  },
  context: Pick<z.RefinementCtx<unknown>, "addIssue">,
): void {
  const configuration = response.configuration;

  if (response.status === "succeeded") {
    validateSucceededActionConfiguration(action, configuration, context);
  }

  if (response.readiness !== undefined) {
    if (!configuration) {
      context.addIssue({
        code: "custom",
        message: "Readiness requires a bound configuration summary",
        path: ["readiness"],
      });
    } else {
      const expectedNotice = PRODUCT_REGISTRY[configuration.productId].notice;
      const acknowledgement = response.readiness.acknowledgement;
      if (
        acknowledgement.status !== "not-applicable" &&
        (acknowledgement.noticeId !== expectedNotice.id ||
          acknowledgement.noticeVersion !== expectedNotice.noticeVersion)
      ) {
        context.addIssue({
          code: "custom",
          message: "Readiness acknowledgement must match the bound product notice",
          path: ["readiness", "acknowledgement"],
        });
      }
    }
  }
}

function hasCurrentNotice(configuration: ClientConfigurationSummary): boolean {
  const expected = PRODUCT_REGISTRY[configuration.productId].notice;
  const [notice] = configuration.notices;
  return (
    notice !== undefined && configuration.notices.length === 1 && matchesNotice(notice, expected)
  );
}

function validateReadyActionResponse(
  response: {
    readonly status: ConfigurationOperationStatus;
    readonly configuration?: ClientConfigurationSummary;
    readonly readiness?: z.infer<typeof ReadinessSchema>;
  },
  context: Pick<z.RefinementCtx<unknown>, "addIssue">,
): void {
  if (!response.readiness?.ready) return;

  if (response.status !== "succeeded") {
    context.addIssue({
      code: "custom",
      message: "A failed action cannot report ready",
      path: ["readiness"],
    });
    return;
  }

  const configuration = response.configuration;
  if (!configuration) {
    context.addIssue({
      code: "custom",
      message: "Ready readiness requires a bound configuration summary",
      path: ["configuration"],
    });
    return;
  }

  // The summary schemas already validate the transport tuple, the exact-model
  // pattern and the product model policy; the readiness schema and
  // `validateActionResponseBinding` already bind the acknowledgement to the
  // current product notice. Only the ready-only constraints belong here.
  if (configuration.selectedModelId === null) {
    context.addIssue({
      code: "custom",
      message: "Ready readiness requires an exact selected model",
      path: ["configuration", "selectedModelId"],
    });
  }

  if (!hasCurrentNotice(configuration)) {
    context.addIssue({
      code: "custom",
      message: "Ready readiness requires the current product notice",
      path: ["configuration", "notices"],
    });
  }
}

function safeActionResponse<Action extends ClientConfigurationActionName>(action: Action) {
  const schema = z
    .strictObject({
      action: z.literal(action),
      ...ConfigurationActionResponseShape,
    })
    .superRefine((response, context) => {
      validateActionResponseBinding(action, response, context);
      validateReadyActionResponse(response, context);
    });
  return schema;
}

const TestConfigurationActionResponseSchema = z
  .strictObject({
    action: z.literal("test"),
    ...ConfigurationActionResponseShape,
    readiness: ReadinessSchema,
  })
  .superRefine((response, context) => {
    validateActionResponseBinding("test", response, context);
    validateReadyActionResponse(response, context);
  });

export const ClientConfigurationActionResponseSchema = z.discriminatedUnion("action", [
  safeActionResponse("create"),
  safeActionResponse("inspect"),
  safeActionResponse("select"),
  TestConfigurationActionResponseSchema,
  safeActionResponse("update"),
  safeActionResponse("delete"),
]);
export type ClientConfigurationActionResponse = z.infer<
  typeof ClientConfigurationActionResponseSchema
>;
