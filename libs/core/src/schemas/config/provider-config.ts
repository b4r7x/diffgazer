import { z } from "zod";
import {
  isModelIdAllowedForProduct,
  PRODUCT_REGISTRY,
  type ProductNotice,
} from "../../providers/product-registry.js";
import { AcceptedAcknowledgementSchema, ReadinessSchema } from "./readiness.js";
import {
  getHostedApiEndpointTuple,
  HostedApiEndpointSchema,
  HostedApiProductIdSchema,
  HostedApiTransportInputSchema,
  LocalCliProductIdSchema,
  LocalCliTransportInputSchema,
  LocalHttpAuthenticationModeSchema,
  LocalHttpProductIdSchema,
  LocalHttpTransportInputSchema,
  LocalOpenAIPresetIdSchema,
  LoopbackHttpEndpointSchema,
  matchesHostedApiTransportTuple,
  matchesLocalHttpTransportTuple,
  RemovedProductIdSchema,
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

function containsOpaqueReferenceControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const codePoint = character.codePointAt(0) ?? 0;
    return (
      codePoint <= 0x1f ||
      (codePoint >= 0x80 && codePoint <= 0x9f) ||
      codePoint === 0x7f ||
      codePoint === 0x2028 ||
      codePoint === 0x2029
    );
  });
}

// Keep path starts separate from the text that follows them.  We only need to
// prove that a client-safe string contains a path; consuming the complete
// token would make punctuation-sensitive boundaries both brittle and easy to
// bypass (for example `notice,/usr/local/bin/codex`).
const NON_PATH_CHARACTER = "[^\\\\/\\s\"'`<>{},;!?()\\[\\]]";
const FILESYSTEM_PATH_START_PATTERN = /(?:^|[^A-Za-z0-9_.-])(?:~[\\/]|[A-Za-z]:[\\/]|\.{1,2}[\\/])/;
const UNC_PATH_START_PATTERN = new RegExp(
  String.raw`(?:^|[^A-Za-z0-9_.-])\\\\(?=${NON_PATH_CHARACTER}+[\\/]${NON_PATH_CHARACTER}+)`,
);

// A slash in normal prose (`Use / for alternatives`, `https://…`, or `a/b`)
// is not a filesystem path.  Require either another path separator, a
// conventional filesystem root, or punctuation that directly introduces the
// root.  The second branch deliberately excludes slash/backslash as a
// boundary, preventing the second slash in `https://` from becoming a path.
const UNIX_PATH_START_PATTERN =
  /(?:^|[^A-Za-z0-9_.\\/-])\/(?=(?:[A-Za-z0-9._~-]+[\\/]|(?:Users|home|private|var|tmp|usr|bin|sbin|srv|opt|etc|run|root|dev|proc|Applications|Library|System|Volumes)(?:[\\/]|$)))/;
const PUNCTUATED_UNIX_PATH_PATTERN = /(?:^|[,:;=()[\]{}])\s*\/(?=[A-Za-z0-9._~-])/;
const PUNCTUATED_UNIX_ROOT_PATTERN = /(?:^|[,:;=()[\]{}])\s*\/(?=$|[.,;:!?()[\]{}])/;

function containsFilesystemPath(value: string): boolean {
  return (
    FILESYSTEM_PATH_START_PATTERN.test(value) ||
    UNC_PATH_START_PATTERN.test(value) ||
    UNIX_PATH_START_PATTERN.test(value) ||
    PUNCTUATED_UNIX_PATH_PATTERN.test(value) ||
    PUNCTUATED_UNIX_ROOT_PATTERN.test(value)
  );
}

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

export const HostedApiConfigurationInputSchema = HostedApiTransportInputSchema.safeExtend({
  credential: WriteOnlySecretInputSchema.optional(),
});
export type HostedApiConfigurationInput = z.infer<typeof HostedApiConfigurationInputSchema>;

export const LocalHttpConfigurationInputSchema = LocalHttpTransportInputSchema.safeExtend({
  bearerToken: WriteOnlySecretInputSchema.optional(),
}).superRefine((input, context) => {
  if (input.authentication === "none" && input.bearerToken !== undefined) {
    context.addIssue({
      code: "custom",
      message: "Bearer input requires optional local bearer authentication",
      path: ["bearerToken"],
    });
  }
});
export type LocalHttpConfigurationInput = z.infer<typeof LocalHttpConfigurationInputSchema>;

export const LocalCliConfigurationInputSchema = LocalCliTransportInputSchema;
export type LocalCliConfigurationInput = z.infer<typeof LocalCliConfigurationInputSchema>;

export const ClientConfigurationInputSchema = z.discriminatedUnion("transportFamily", [
  HostedApiConfigurationInputSchema,
  LocalHttpConfigurationInputSchema,
  LocalCliConfigurationInputSchema,
]);
export type ClientConfigurationInput = z.infer<typeof ClientConfigurationInputSchema>;

const CreateConfigurationActionSchema = z.strictObject({
  action: z.literal("create"),
  input: ClientConfigurationInputSchema,
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

const DeleteConfigurationActionSchema = z.strictObject({
  action: z.literal("delete"),
  configurationId: ConfigurationIdSchema,
  expectedRevision: ConfigurationRevisionSchema,
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

const SafeNoticeIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/)
  .refine(
    (value) => !containsOpaqueReferenceControlCharacter(value),
    "Notice id must not contain control characters",
  )
  .refine(
    (value) =>
      !/(?:api(?:[._:-]?key)|authorization|bearer|cookie|password|credential|secret|env(?:ironment)?|home|path|argv|executable|control)/i.test(
        value,
      ) &&
      !/\b(?:account|workspace)[._:-]?(?:secret|id|identifier|ref|reference|token|key|credential|value)/i.test(
        value,
      ),
    "Notice id must not contain secret or private-path material",
  );

const SafeNoticeLineSchema = z
  .string()
  .min(1)
  .max(512)
  .refine((value) => {
    if (containsOpaqueReferenceControlCharacter(value)) return false;

    if (
      /\b(?:api(?:[ _-]?key)|authorization|bearer|cookie|password|credential|secret|env(?:ironment)?|home|path|argv|executable|control)\b/i.test(
        value,
      )
    ) {
      return false;
    }

    if (
      /\b(?:auth|token|account|workspace)(?:[\s_/-]+)(?:secret|id|identifier|ref(?:erence)?|token|key|credential|value|name|account|workspace|env|environment|path|file)\b/i.test(
        value,
      )
    ) {
      return false;
    }

    if (
      /(?:^|\s)--?(?:api(?:[ _-]?key)|authorization|auth|bearer|cookie|password|credential|secret|token|env(?:ironment)?)(?:\s+|[:=])\S+/i.test(
        value,
      )
    ) {
      return false;
    }

    if (
      /\b(?:api(?:[ _-]?key)|authorization|auth|bearer|cookie|password|credential|secret|token|env(?:ironment)?)(?:\s*[:=])\s*\S+/i.test(
        value,
      )
    ) {
      return false;
    }

    if (
      /\b[A-Z][A-Z0-9]*(?:[_-][A-Z0-9]+)*[_-](?:API[_-]?KEY|TOKEN|SECRET|AUTH(?:ORIZATION)?|CREDENTIAL|PASSWORD|COOKIE|BEARER)\b/.test(
        value,
      )
    ) {
      return false;
    }

    if (
      /(?:^|[\s=:])(?:sk|pk|ghp|github_pat|xox[baprs]-)[A-Za-z0-9_-]{8,}/i.test(value) ||
      /\b(?:bearer|basic)\s+[A-Za-z0-9._~+/-]{8,}=*/i.test(value)
    ) {
      return false;
    }

    if (containsFilesystemPath(value)) {
      return false;
    }

    return !/-----BEGIN [A-Z ]+PRIVATE KEY-----/i.test(value);
  }, "Notice text must not contain secret or private-path material");

export const ClientConfigurationNoticeSchema = z.strictObject({
  id: SafeNoticeIdSchema,
  noticeVersion: z.number().int().positive(),
  acknowledgement: z.literal("required"),
  acknowledgeBefore: z.literal("first-context-send"),
  renewAcknowledgementOn: z.literal("material-notice-change"),
  billing: z.array(SafeNoticeLineSchema).max(16),
  privacy: z.array(SafeNoticeLineSchema).max(16),
});
export type ClientConfigurationNotice = z.infer<typeof ClientConfigurationNoticeSchema>;

const SupportedConfigurationActionsSchema = z.array(
  z.enum(["inspect", "select", "test", "update", "delete"]),
);
const RemovedConfigurationActionsSchema = z.array(z.enum(["inspect", "delete"]));

const ConfigurationReferenceSchema = z
  .string()
  .min(1)
  .max(256)
  .refine(
    (value) => !containsOpaqueReferenceControlCharacter(value),
    "Reference must not contain control characters",
  )
  .refine((value) => value === value.trim(), "Reference must not have surrounding whitespace");

const SafeConfigurationReferenceSchema = ConfigurationReferenceSchema.refine(
  (value) =>
    !/(?:api[_ -]?key|auth(?:entication)?|bearer|credential|cookie|password|secret|token)\b/i.test(
      value,
    ) && !containsFilesystemPath(value),
  "Configuration reference must not contain secret or private-path material",
);

const SafeClientConfigurationNoticeSchema = z.strictObject({
  id: SafeNoticeIdSchema,
  noticeVersion: z.number().int().positive(),
  acknowledgement: z.literal("required"),
  acknowledgeBefore: z.literal("first-context-send"),
  renewAcknowledgementOn: z.literal("material-notice-change"),
  billing: z.array(SafeNoticeLineSchema).max(16),
  privacy: z.array(SafeNoticeLineSchema).max(16),
});

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
  notices: z.array(SafeClientConfigurationNoticeSchema).max(16),
} as const;

const HostedApiConfigurationSummarySchema = z
  .strictObject({
    ...ConfigurationSummaryBaseShape,
    status: z.literal("supported"),
    transportFamily: z.literal("hosted-api"),
    productId: HostedApiProductIdSchema,
    endpoint: HostedApiEndpointSchema,
    region: ConfigurationReferenceSchema.optional(),
    workspace: SafeConfigurationReferenceSchema.optional(),
    availableActions: SupportedConfigurationActionsSchema,
  })
  .superRefine((summary, context) => {
    validateSupportedSummaryBoundary(summary, context);
    const tuple = getHostedApiEndpointTuple(summary.productId, summary.endpoint, summary.region);
    if (!tuple || !matchesHostedApiTransportTuple(summary)) {
      context.addIssue({
        code: "custom",
        message: tuple
          ? "Workspace reference must match the selected endpoint"
          : "Endpoint and region must match the selected product",
        path: ["endpoint"],
      });
      if (tuple && "workspaceBound" in tuple && tuple.workspaceBound) {
        context.addIssue({
          code: "custom",
          message: "Selected endpoint requires a workspace reference",
          path: ["workspace"],
        });
      } else if (tuple && summary.workspace !== undefined) {
        context.addIssue({
          code: "custom",
          message: "Selected endpoint does not accept a workspace reference",
          path: ["workspace"],
        });
      }
    }
  });

const LocalHttpConfigurationSummarySchema = z
  .strictObject({
    ...ConfigurationSummaryBaseShape,
    status: z.literal("supported"),
    transportFamily: z.literal("local-http"),
    productId: LocalHttpProductIdSchema,
    endpoint: LoopbackHttpEndpointSchema,
    authentication: LocalHttpAuthenticationModeSchema,
    presetId: LocalOpenAIPresetIdSchema.optional(),
    availableActions: SupportedConfigurationActionsSchema,
  })
  .superRefine((summary, context) => {
    validateSupportedSummaryBoundary(summary, context);
    if (
      !matchesLocalHttpTransportTuple({
        productId: summary.productId,
        endpoint: summary.endpoint,
        presetId: summary.presetId,
      })
    ) {
      context.addIssue({
        code: "custom",
        message:
          summary.productId === "ollama"
            ? "Local OpenAI presets do not apply to Ollama"
            : "Preset endpoint does not match its fixed identity",
        path: summary.productId === "ollama" ? ["presetId"] : ["endpoint"],
      });
    }
  });

const LocalCliConfigurationSummarySchema = z
  .strictObject({
    ...ConfigurationSummaryBaseShape,
    status: z.literal("supported"),
    transportFamily: z.literal("local-cli"),
    productId: LocalCliProductIdSchema,
    installationId: LocalCliTransportInputSchema.shape.installationId,
    availableActions: SupportedConfigurationActionsSchema,
  })
  .superRefine((summary, context) => {
    validateSupportedSummaryBoundary(summary, context);
  });

const RemovedConfigurationSummarySchema = z.strictObject({
  ...ConfigurationSummaryBaseShape,
  status: z.literal("removed"),
  transportFamily: z.literal("hosted-api"),
  productId: RemovedProductIdSchema,
  selectedModelId: z.null(),
  availableActions: RemovedConfigurationActionsSchema,
});

export const ClientConfigurationSummarySchema = z.union([
  HostedApiConfigurationSummarySchema,
  LocalHttpConfigurationSummarySchema,
  LocalCliConfigurationSummarySchema,
  RemovedConfigurationSummarySchema,
]);
export type ClientConfigurationSummary = z.infer<typeof ClientConfigurationSummarySchema>;

export const CONFIGURATION_OPERATION_STATUSES = ["succeeded", "failed", "conflict"] as const;
export const ConfigurationOperationStatusSchema = z.enum(CONFIGURATION_OPERATION_STATUSES);
export type ConfigurationOperationStatus = z.infer<typeof ConfigurationOperationStatusSchema>;

type SupportedConfigurationSummary = Exclude<ClientConfigurationSummary, { status: "removed" }>;

const ConfigurationActionResponseShape = {
  status: ConfigurationOperationStatusSchema,
  configuration: ClientConfigurationSummarySchema.optional(),
  readiness: ReadinessSchema.optional(),
  notices: z.array(SafeClientConfigurationNoticeSchema).max(16).optional(),
  availableActions: z.array(ClientConfigurationActionNameSchema).max(6).optional(),
} as const;

function matchesSupportedConfigurationTuple(configuration: SupportedConfigurationSummary): boolean {
  if (configuration.transportFamily === "hosted-api") {
    return (
      getHostedApiEndpointTuple(
        configuration.productId,
        configuration.endpoint,
        configuration.region,
      ) !== undefined &&
      matchesHostedApiTransportTuple({
        productId: configuration.productId,
        endpoint: configuration.endpoint,
        region: configuration.region,
        workspace: configuration.workspace,
      })
    );
  }

  if (configuration.transportFamily === "local-http") {
    return matchesLocalHttpTransportTuple(configuration);
  }

  return configuration.installationId.length > 0;
}

function hasSafeExactModel(configuration: SupportedConfigurationSummary): boolean {
  const modelId = configuration.selectedModelId;
  if (modelId === null) return false;

  return !modelId.split(/[./:_-]/).some((segment) => segment.toLowerCase() === "latest");
}

/**
 * A succeeded action must carry the summary its own outcome implies: delete
 * leaves nothing supported behind, inspect may report a supported or a removed
 * record, and every other action lands on a supported one. Owning this here
 * keeps the guarantee on the wire contract itself, so both the server that
 * emits a response and the client that parses one fail on the same shape.
 */
function validateSucceededActionConfiguration(
  action: ClientConfigurationActionName,
  configuration: ClientConfigurationSummary | undefined,
  context: Pick<z.RefinementCtx<unknown>, "addIssue">,
): void {
  if (action === "delete") {
    if (configuration?.status === "supported") {
      context.addIssue({
        code: "custom",
        message: "A succeeded delete response cannot contain a supported configuration",
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
    return;
  }

  if (action !== "inspect" && configuration.status !== "supported") {
    context.addIssue({
      code: "custom",
      message: `A succeeded ${action} response requires a supported configuration`,
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
    readonly notices?: readonly ClientConfigurationNotice[];
    readonly availableActions?: readonly ClientConfigurationActionName[];
  },
  context: Pick<z.RefinementCtx<unknown>, "addIssue">,
): void {
  const configuration = response.configuration;

  if (response.status === "succeeded") {
    validateSucceededActionConfiguration(action, configuration, context);
  }

  if (response.notices !== undefined) {
    if (!configuration || configuration.status === "removed") {
      context.addIssue({
        code: "custom",
        message: "Response notices require a supported bound configuration",
        path: ["notices"],
      });
    } else if (!hasCanonicalProductNotice(configuration.productId, response.notices)) {
      context.addIssue({
        code: "custom",
        message: "Response notices must match the bound product notice",
        path: ["notices"],
      });
    }
  }

  if (response.availableActions !== undefined && !configuration) {
    context.addIssue({
      code: "custom",
      message: "Response actions require a bound configuration summary",
      path: ["availableActions"],
    });
  }

  if (response.readiness !== undefined) {
    if (!configuration) {
      context.addIssue({
        code: "custom",
        message: "Readiness requires a bound configuration summary",
        path: ["readiness"],
      });
    } else if (configuration.status === "supported") {
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
    } else if (response.readiness.status !== "removed") {
      context.addIssue({
        code: "custom",
        message: "Removed configurations cannot claim supported readiness",
        path: ["readiness"],
      });
    }
  }
}

function hasCurrentNotice(configuration: SupportedConfigurationSummary): boolean {
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
    readonly notices?: readonly ClientConfigurationNotice[];
  },
  context: Pick<z.RefinementCtx<unknown>, "addIssue">,
): void {
  if (!response.readiness?.ready) return;

  if (response.status !== "succeeded") {
    context.addIssue({
      code: "custom",
      message: "A failed or conflicting action cannot report ready",
      path: ["readiness"],
    });
    return;
  }

  const configuration = response.configuration;
  if (!configuration || configuration.status === "removed") {
    context.addIssue({
      code: "custom",
      message: "Ready readiness requires a supported configuration summary",
      path: ["configuration"],
    });
    return;
  }

  if (!matchesSupportedConfigurationTuple(configuration)) {
    context.addIssue({
      code: "custom",
      message: "Ready readiness requires the exact configuration transport tuple",
      path: ["configuration"],
    });
  }

  if (!hasSafeExactModel(configuration)) {
    context.addIssue({
      code: "custom",
      message: "Ready readiness requires an exact selected model",
      path: ["configuration", "selectedModelId"],
    });
  }

  if (!hasAllowedSelectedModel(configuration.productId, configuration.selectedModelId)) {
    context.addIssue({
      code: "custom",
      message: "Ready readiness requires a model allowed by the bound product policy",
      path: ["configuration", "selectedModelId"],
    });
  }

  const expectedNotice = PRODUCT_REGISTRY[configuration.productId].notice;
  if (!hasCurrentNotice(configuration)) {
    context.addIssue({
      code: "custom",
      message: "Ready readiness requires the current product notice",
      path: ["configuration", "notices"],
    });
  }

  const acknowledgement = response.readiness.acknowledgement;
  if (
    acknowledgement.status !== "accepted" ||
    acknowledgement.noticeId !== expectedNotice.id ||
    acknowledgement.noticeVersion !== expectedNotice.noticeVersion ||
    !configuration.notices.some(
      (notice) =>
        notice.id === acknowledgement.noticeId &&
        notice.noticeVersion === acknowledgement.noticeVersion,
    )
  ) {
    context.addIssue({
      code: "custom",
      message: "Ready readiness requires acknowledgement of the current product notice",
      path: ["readiness", "acknowledgement"],
    });
  }

  if (
    response.notices !== undefined &&
    (response.notices.length !== 1 ||
      response.notices[0] === undefined ||
      !matchesNotice(response.notices[0], expectedNotice))
  ) {
    context.addIssue({
      code: "custom",
      message: "Response notices must match the current product notice",
      path: ["notices"],
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
