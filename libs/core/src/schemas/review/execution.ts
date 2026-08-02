import { type RefinementCtx, z } from "zod";
import { isModelIdAllowedForProduct, PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import { sha256CanonicalJson, sha256CanonicalJsonSync } from "../canonical-json.js";
import {
  ConfigurationIdSchema,
  ConfigurationRevisionSchema,
  ExactModelIdSchema,
} from "../config/provider-config.js";
import {
  HostedApiEndpointSchema,
  LOCAL_OPENAI_PRESET_ENDPOINTS,
  LocalCliInstallationIdSchema,
  LocalHttpAuthenticationModeSchema,
  LocalHttpProductIdSchema,
  LoopbackHttpEndpointSchema,
  RunnableProductIdSchema,
  type TransportFamily,
  TransportFamilySchema,
} from "../config/transports.js";
import { ReviewResultSchema } from "./issues.js";

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
const LATEST_ALIAS_PATTERN = /(?:^|[/:._-])latest(?:$|[/:._-])/i;
export const Sha256HexSchema = z.string().regex(SHA256_HEX_PATTERN);
export type Sha256Hex = z.infer<typeof Sha256HexSchema>;

const PositiveIntegerSchema = z.number().int().positive();
const NonnegativeIntegerSchema = z.number().int().nonnegative();
const SafeReferenceDigestSchema = Sha256HexSchema;
const SafeIdentitySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const SafeVersionSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ._:+()-]*$/);

export const ExecutionLimitsSchema = z
  .strictObject({
    maxInputTokens: PositiveIntegerSchema,
    maxOutputTokens: PositiveIntegerSchema,
    maxResponseBytes: PositiveIntegerSchema,
    wallTimeMs: PositiveIntegerSchema,
    maxRetries: NonnegativeIntegerSchema,
    maxConcurrency: PositiveIntegerSchema,
    maxCostUsd: z.number().finite().nonnegative(),
  })
  .readonly();
export type ExecutionLimits = z.infer<typeof ExecutionLimitsSchema>;

export const RuntimeIdentitySchema = z
  .strictObject({
    identity: SafeIdentitySchema,
    version: SafeVersionSchema,
  })
  .readonly();
export type RuntimeIdentity = z.infer<typeof RuntimeIdentitySchema>;

type ExecutionIdentity = {
  authentication: z.infer<typeof LocalHttpAuthenticationModeSchema> | null;
  credentialReferenceIdentity: string | null;
  installationId: z.infer<typeof LocalCliInstallationIdSchema> | null;
  normalizedEndpoint: string | null;
  productId: z.infer<typeof RunnableProductIdSchema>;
  region: string | null;
  runtime: RuntimeIdentity | null;
  transportFamily: TransportFamily;
  workspaceAccountReference: string | null;
};

type ExecutionIdentityIssue = {
  message: string;
  path: string[];
};

/**
 * Model IDs are part of the admitted execution tuple, not an opaque value that
 * can be moved between products.  The product registry deliberately leaves
 * discovered-exact models open because they are live observations; the other
 * policy kinds still have a closed allowlist/family contract here.
 */
function matchesProductModel(productId: z.infer<typeof RunnableProductIdSchema>, modelId: string) {
  if (!ExactModelIdSchema.safeParse(modelId).success || LATEST_ALIAS_PATTERN.test(modelId)) {
    return false;
  }

  return isModelIdAllowedForProduct(productId, modelId);
}

function addModelIdentityIssue(
  productId: z.infer<typeof RunnableProductIdSchema>,
  modelId: string,
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  if (!matchesProductModel(productId, modelId)) {
    addIssue(context, {
      message: "Model does not match the selected product policy",
      path: ["modelId"],
    });
  }
}

function addIssue(
  context: Pick<RefinementCtx<unknown>, "addIssue">,
  issue: ExecutionIdentityIssue,
) {
  context.addIssue({ code: "custom", ...issue });
}

function validateHostedTuple(identity: ExecutionIdentity): ExecutionIdentityIssue[] {
  const issues: ExecutionIdentityIssue[] = [];
  if (identity.authentication !== null) {
    issues.push({
      message: "Hosted execution cannot record local HTTP authentication",
      path: ["authentication"],
    });
  }
  const product = PRODUCT_REGISTRY[identity.productId];
  const endpoint = identity.normalizedEndpoint;

  if (identity.runtime === null) {
    issues.push({
      message: "Hosted execution requires runtime identity",
      path: ["runtime"],
    });
  }
  if (identity.credentialReferenceIdentity === null) {
    issues.push({
      message: "Hosted execution requires a credential reference identity",
      path: ["credentialReferenceIdentity"],
    });
  }
  if (identity.installationId !== null) {
    issues.push({
      message: "Hosted execution cannot record a CLI installation",
      path: ["installationId"],
    });
  }
  if (endpoint === null || !HostedApiEndpointSchema.safeParse(endpoint).success) {
    issues.push({
      message: "Hosted execution requires a normalized HTTPS endpoint",
      path: ["normalizedEndpoint"],
    });
    return issues;
  }

  const matchingProfile = product.configuration.endpoints.find(
    (profile) =>
      profile.endpoint === endpoint &&
      (("region" in profile ? profile.region : undefined) ?? null) === identity.region,
  );
  if (!matchingProfile) {
    const endpointMatches = product.configuration.endpoints.some(
      (profile) => profile.endpoint === endpoint,
    );
    issues.push({
      message: endpointMatches
        ? "Region does not match the selected product endpoint"
        : "Endpoint does not match the selected product transport tuple",
      path: [endpointMatches ? "region" : "normalizedEndpoint"],
    });
    return issues;
  }

  if (
    "workspaceBound" in matchingProfile &&
    matchingProfile.workspaceBound === true &&
    identity.workspaceAccountReference === null
  ) {
    issues.push({
      message: "Selected product endpoint requires a workspace or account reference",
      path: ["workspaceAccountReference"],
    });
  }
  if (!("workspaceBound" in matchingProfile) && identity.workspaceAccountReference !== null) {
    issues.push({
      message: "Selected product endpoint does not accept a workspace or account reference",
      path: ["workspaceAccountReference"],
    });
  }

  return issues;
}

function validateLocalHttpTuple(identity: ExecutionIdentity): ExecutionIdentityIssue[] {
  const issues: ExecutionIdentityIssue[] = [];
  if (identity.authentication === null) {
    issues.push({
      message: "Local HTTP execution requires an authentication mode",
      path: ["authentication"],
    });
  }
  if (identity.authentication === "none" && identity.credentialReferenceIdentity !== null) {
    issues.push({
      message: "Local HTTP execution without authentication cannot record a credential reference",
      path: ["credentialReferenceIdentity"],
    });
  }
  if (
    identity.normalizedEndpoint === null ||
    !LoopbackHttpEndpointSchema.safeParse(identity.normalizedEndpoint).success
  ) {
    issues.push({
      message: "Local HTTP execution requires a normalized loopback endpoint",
      path: ["normalizedEndpoint"],
    });
  }
  if (identity.region !== null) {
    issues.push({ message: "Local HTTP execution cannot record a region", path: ["region"] });
  }
  if (identity.workspaceAccountReference !== null) {
    issues.push({
      message: "Local HTTP execution cannot record a workspace or account reference",
      path: ["workspaceAccountReference"],
    });
  }
  if (identity.installationId !== null) {
    issues.push({
      message: "Local HTTP execution cannot record a CLI installation",
      path: ["installationId"],
    });
  }
  if (identity.runtime === null) {
    issues.push({ message: "Local HTTP execution requires runtime identity", path: ["runtime"] });
  }
  return issues;
}

function validateLocalCliTuple(identity: ExecutionIdentity): ExecutionIdentityIssue[] {
  const issues: ExecutionIdentityIssue[] = [];
  if (identity.authentication !== null) {
    issues.push({
      message: "Local CLI execution cannot record local HTTP authentication",
      path: ["authentication"],
    });
  }
  if (identity.normalizedEndpoint !== null) {
    issues.push({
      message: "Local CLI execution cannot record an endpoint",
      path: ["normalizedEndpoint"],
    });
  }
  if (identity.region !== null) {
    issues.push({ message: "Local CLI execution cannot record a region", path: ["region"] });
  }
  if (identity.workspaceAccountReference !== null) {
    issues.push({
      message: "Local CLI execution cannot record a workspace or account reference",
      path: ["workspaceAccountReference"],
    });
  }
  if (identity.credentialReferenceIdentity !== null) {
    issues.push({
      message: "Local CLI execution uses vendor-managed authentication, not a credential reference",
      path: ["credentialReferenceIdentity"],
    });
  }
  if (identity.installationId === null) {
    issues.push({
      message: "Local CLI execution requires installation identity",
      path: ["installationId"],
    });
  }
  if (identity.runtime === null) {
    issues.push({ message: "Local CLI execution requires runtime identity", path: ["runtime"] });
  }
  return issues;
}

/**
 * Runtime identity is part of the admitted tuple, not a free-form label.  The
 * local transports have a closed runtime vocabulary: an Ollama endpoint must
 * be probed as Ollama, the two local-openai presets retain their server
 * identity, and a CLI runtime must be the selected vendor CLI.  Hosted
 * products intentionally leave this field to the Diffgazer server identity;
 * no made-up provider version range is inferred here.
 */
function getExpectedLocalRuntimeIdentities(identity: ExecutionIdentity): readonly string[] | null {
  switch (identity.productId) {
    case "ollama":
      return ["ollama"];
    case "local-openai":
      if (identity.normalizedEndpoint === LOCAL_OPENAI_PRESET_ENDPOINTS["lm-studio"])
        return ["lm-studio"];
      if (identity.normalizedEndpoint === LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"])
        return ["llama-cpp"];
      return ["lm-studio", "llama-cpp"];
    case "codex-cli":
      return ["codex-cli"];
    case "copilot-cli":
      return ["copilot-cli"];
    default:
      return null;
  }
}

function validateRuntimeIdentity(identity: ExecutionIdentity): ExecutionIdentityIssue[] {
  if (identity.runtime === null) return [];
  const expectedIdentities = getExpectedLocalRuntimeIdentities(identity);
  if (expectedIdentities === null || expectedIdentities.includes(identity.runtime.identity)) {
    return [];
  }
  return [
    {
      message: "Runtime identity does not match the selected local product and endpoint",
      path: ["runtime", "identity"],
    },
  ];
}

function getExecutionIdentityIssues(identity: ExecutionIdentity): ExecutionIdentityIssue[] {
  const product = PRODUCT_REGISTRY[identity.productId];
  const issues: ExecutionIdentityIssue[] = [];

  if (product.transportFamily !== identity.transportFamily) {
    issues.push({
      message: "Product does not belong to the transport family",
      path: ["transportFamily"],
    });
    return issues;
  }

  switch (identity.transportFamily) {
    case "hosted-api":
      issues.push(...validateHostedTuple(identity));
      break;
    case "local-http":
      if (!LocalHttpProductIdSchema.safeParse(identity.productId).success) {
        issues.push({
          message: "Product does not belong to the local HTTP transport family",
          path: ["productId"],
        });
      }
      issues.push(...validateLocalHttpTuple(identity));
      break;
    case "local-cli":
      issues.push(...validateLocalCliTuple(identity));
      break;
  }

  issues.push(...validateRuntimeIdentity(identity));

  return issues;
}

function addExecutionIdentityIssues(
  identity: ExecutionIdentity,
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  for (const issue of getExecutionIdentityIssues(identity)) addIssue(context, issue);
}

export const EvidenceKeySchema = z
  .strictObject({
    authentication: LocalHttpAuthenticationModeSchema.nullable(),
    credentialReferenceIdentity: SafeReferenceDigestSchema.nullable(),
    installationId: LocalCliInstallationIdSchema.nullable(),
    productId: RunnableProductIdSchema,
    transportFamily: TransportFamilySchema,
    normalizedEndpoint: z.union([HostedApiEndpointSchema, LoopbackHttpEndpointSchema]).nullable(),
    region: SafeIdentitySchema.nullable(),
    workspaceAccountReference: SafeReferenceDigestSchema.nullable(),
    modelId: ExactModelIdSchema,
    // Evidence is executable only when the runtime/server/CLI identity that was
    // probed is part of the immutable tuple.  Receipts keep this field optional
    // for terminal records produced before a runtime observation is available;
    // an admitted EvidenceKey cannot omit it.
    runtime: RuntimeIdentitySchema,
    structuredOutputSchemaSha256: Sha256HexSchema,
    noticeVersion: PositiveIntegerSchema,
    limits: ExecutionLimitsSchema,
  })
  .superRefine((evidence, context) => {
    addModelIdentityIssue(evidence.productId, evidence.modelId, context);
    addExecutionIdentityIssues(evidence, context);
  })
  .readonly();
export type EvidenceKey = z.infer<typeof EvidenceKeySchema>;

export const ExecutionFingerprintInputSchema = z
  .strictObject({
    configurationId: ConfigurationIdSchema,
    configurationRevision: ConfigurationRevisionSchema,
    evidenceKey: EvidenceKeySchema,
  })
  .readonly();
export type ExecutionFingerprintInput = z.infer<typeof ExecutionFingerprintInputSchema>;

export function hashEvidenceKey(input: z.input<typeof EvidenceKeySchema>): Promise<string> {
  return sha256CanonicalJson(EvidenceKeySchema.parse(input));
}

export function hashExecutionFingerprint(
  input: z.input<typeof ExecutionFingerprintInputSchema>,
): Promise<string> {
  return sha256CanonicalJson(ExecutionFingerprintInputSchema.parse(input));
}

/**
 * The receipt relation is the immutable admitted-plan projection that can be
 * recomputed from a persisted v1 receipt.  Runtime outcome fields (usage,
 * timestamps, attempts and terminal status) intentionally do not participate:
 * retries share one admitted plan fingerprint, while any changed tuple,
 * revision, notice, schema contract or execution limit must produce a new one.
 */
export const ExecutionReceiptFingerprintInputSchema = z
  .strictObject({
    authentication: LocalHttpAuthenticationModeSchema.nullable(),
    configurationId: ConfigurationIdSchema,
    configurationRevision: ConfigurationRevisionSchema,
    credentialReferenceIdentity: SafeReferenceDigestSchema.nullable(),
    installationId: LocalCliInstallationIdSchema.nullable(),
    productId: RunnableProductIdSchema,
    transportFamily: TransportFamilySchema,
    modelId: ExactModelIdSchema,
    normalizedEndpoint: z.union([HostedApiEndpointSchema, LoopbackHttpEndpointSchema]).nullable(),
    region: SafeIdentitySchema.nullable(),
    workspaceAccountReference: SafeReferenceDigestSchema.nullable(),
    runtime: RuntimeIdentitySchema.nullable(),
    structuredOutputSchemaSha256: Sha256HexSchema,
    noticeVersion: PositiveIntegerSchema,
    limits: ExecutionLimitsSchema,
  })
  .readonly();
export type ExecutionReceiptFingerprintInput = z.infer<
  typeof ExecutionReceiptFingerprintInputSchema
>;

export function hashExecutionReceiptFingerprintSync(
  input: z.input<typeof ExecutionReceiptFingerprintInputSchema>,
): string {
  return sha256CanonicalJsonSync(ExecutionReceiptFingerprintInputSchema.parse(input));
}

export async function hashExecutionReceiptFingerprint(
  input: z.input<typeof ExecutionReceiptFingerprintInputSchema>,
): Promise<string> {
  return hashExecutionReceiptFingerprintSync(input);
}

type NormalizedUsageShape = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedTokens?: number;
  reasoningTokens?: number;
};

function validateNormalizedUsage(
  usage: NormalizedUsageShape,
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  if (
    usage.totalTokens !== undefined &&
    ((usage.inputTokens !== undefined && usage.totalTokens < usage.inputTokens) ||
      (usage.outputTokens !== undefined && usage.totalTokens < usage.outputTokens) ||
      (usage.cachedTokens !== undefined && usage.totalTokens < usage.cachedTokens) ||
      (usage.reasoningTokens !== undefined && usage.totalTokens < usage.reasoningTokens))
  ) {
    context.addIssue({
      code: "custom",
      message: "Total tokens cannot be less than a reported component",
      path: ["totalTokens"],
    });
  }
  if (
    usage.inputTokens !== undefined &&
    usage.outputTokens !== undefined &&
    usage.totalTokens !== undefined &&
    usage.totalTokens !== usage.inputTokens + usage.outputTokens
  ) {
    context.addIssue({
      code: "custom",
      message: "Total tokens must equal input plus output tokens",
      path: ["totalTokens"],
    });
  }
  if (
    usage.cachedTokens !== undefined &&
    usage.inputTokens !== undefined &&
    usage.cachedTokens > usage.inputTokens
  ) {
    context.addIssue({
      code: "custom",
      message: "Cached tokens cannot exceed input tokens",
      path: ["cachedTokens"],
    });
  }
  if (
    usage.reasoningTokens !== undefined &&
    usage.outputTokens !== undefined &&
    usage.reasoningTokens > usage.outputTokens
  ) {
    context.addIssue({
      code: "custom",
      message: "Reasoning tokens cannot exceed output tokens",
      path: ["reasoningTokens"],
    });
  }
}

export const NormalizedUsageSchema = z
  .strictObject({
    inputTokens: NonnegativeIntegerSchema.optional(),
    outputTokens: NonnegativeIntegerSchema.optional(),
    totalTokens: NonnegativeIntegerSchema.optional(),
    cachedTokens: NonnegativeIntegerSchema.optional(),
    reasoningTokens: NonnegativeIntegerSchema.optional(),
  })
  .refine((usage) => Object.values(usage).some((value) => value !== undefined), {
    message: "Reported usage must contain at least one value",
  })
  .superRefine(validateNormalizedUsage)
  .readonly();
export type NormalizedUsage = z.infer<typeof NormalizedUsageSchema>;

export const USAGE_AVAILABILITY = ["reported", "required-missing", "unavailable"] as const;
export const UsageAvailabilitySchema = z.enum(USAGE_AVAILABILITY);
export type UsageAvailability = z.infer<typeof UsageAvailabilitySchema>;

const FAILED_TERMINAL_OUTCOMES = [
  "cancelled",
  "timed-out",
  "transport-failed",
  "schema-failed",
  "budget-exhausted",
] as const;
export const TERMINAL_OUTCOMES = ["completed", ...FAILED_TERMINAL_OUTCOMES] as const;
export const TerminalOutcomeSchema = z.enum(TERMINAL_OUTCOMES);
export type TerminalOutcome = z.infer<typeof TerminalOutcomeSchema>;

const ExecutionReceiptBaseShape = {
  schemaVersion: z.literal(1),
  executionFingerprint: Sha256HexSchema,
  configurationId: ConfigurationIdSchema,
  configurationRevision: ConfigurationRevisionSchema,
  authentication: LocalHttpAuthenticationModeSchema.nullable().optional(),
  credentialReferenceIdentity: SafeReferenceDigestSchema.nullable().optional(),
  installationId: LocalCliInstallationIdSchema.nullable().optional(),
  productId: RunnableProductIdSchema,
  transportFamily: TransportFamilySchema,
  modelId: ExactModelIdSchema,
  normalizedEndpoint: z
    .union([HostedApiEndpointSchema, LoopbackHttpEndpointSchema])
    .nullable()
    .optional(),
  region: SafeIdentitySchema.nullable().optional(),
  workspace: SafeReferenceDigestSchema.nullable().optional(),
  runtime: RuntimeIdentitySchema.nullable().optional(),
  structuredOutputSchemaSha256: Sha256HexSchema,
  noticeVersion: PositiveIntegerSchema,
  limits: ExecutionLimitsSchema,
  attemptCount: NonnegativeIntegerSchema,
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
  usage: NormalizedUsageSchema.optional(),
  usageAvailability: UsageAvailabilitySchema,
} as const;

type ReceiptUsage = {
  limits: ExecutionLimits;
  outcome: TerminalOutcome;
  usage?: NormalizedUsageShape;
  usageAvailability: UsageAvailability;
};

type ReceiptIdentity = {
  authentication: z.infer<typeof LocalHttpAuthenticationModeSchema> | null;
  credentialReferenceIdentity: string | null;
  installationId: z.infer<typeof LocalCliInstallationIdSchema> | null;
  modelId: z.infer<typeof ExactModelIdSchema>;
  normalizedEndpoint: string | null;
  productId: z.infer<typeof RunnableProductIdSchema>;
  region: string | null;
  runtime: RuntimeIdentity | null;
  transportFamily: TransportFamily;
  workspaceAccountReference: string | null;
};

function validateReceiptIdentity(
  receipt: ReceiptIdentity,
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  addModelIdentityIssue(receipt.productId, receipt.modelId, context);
  addExecutionIdentityIssues(receipt, context);
}

function validateReceiptUsage(
  receipt: ReceiptUsage & { productId: z.infer<typeof RunnableProductIdSchema> },
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  if (receipt.usageAvailability === "reported" && receipt.usage === undefined) {
    context.addIssue({
      code: "custom",
      message: "Reported usage requires normalized usage values",
      path: ["usage"],
    });
  }
  if (receipt.usageAvailability !== "reported" && receipt.usage !== undefined) {
    context.addIssue({
      code: "custom",
      message: "Unavailable usage cannot include normalized usage values",
      path: ["usage"],
    });
  }
  if (receipt.usage !== undefined) {
    if (
      receipt.usage.inputTokens !== undefined &&
      receipt.usage.inputTokens > receipt.limits.maxInputTokens
    ) {
      context.addIssue({
        code: "custom",
        message: "Reported input usage exceeds the admitted input-token limit",
        path: ["usage", "inputTokens"],
      });
    }
    if (
      receipt.usage.outputTokens !== undefined &&
      receipt.usage.outputTokens > receipt.limits.maxOutputTokens
    ) {
      context.addIssue({
        code: "custom",
        message: "Reported output usage exceeds the admitted output-token limit",
        path: ["usage", "outputTokens"],
      });
    }
    if (
      receipt.usage.totalTokens !== undefined &&
      receipt.usage.totalTokens > receipt.limits.maxInputTokens + receipt.limits.maxOutputTokens
    ) {
      context.addIssue({
        code: "custom",
        message: "Reported total usage exceeds the admitted token limits",
        path: ["usage", "totalTokens"],
      });
    }
  }
  if (receipt.outcome === "completed" && receipt.usageAvailability === "required-missing") {
    context.addIssue({
      code: "custom",
      message: "Completed execution cannot be missing required usage",
      path: ["usageAvailability"],
    });
  }
  if (
    receipt.outcome === "completed" &&
    PRODUCT_REGISTRY[receipt.productId].admission.usage === "required-terminal" &&
    receipt.usageAvailability !== "reported"
  ) {
    context.addIssue({
      code: "custom",
      message: "This product requires a reported terminal usage record",
      path: ["usageAvailability"],
    });
  }
}

function validateReceiptTiming(
  receipt: {
    attemptCount: number;
    finishedAt: string;
    limits: ExecutionLimits;
    outcome: TerminalOutcome;
    startedAt: string;
  },
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  const startedAtMs = Date.parse(receipt.startedAt);
  const finishedAtMs = Date.parse(receipt.finishedAt);
  if (
    !Number.isFinite(startedAtMs) ||
    !Number.isFinite(finishedAtMs) ||
    finishedAtMs < startedAtMs
  ) {
    context.addIssue({
      code: "custom",
      message: "Finished time cannot precede start time",
      path: ["finishedAt"],
    });
  }
  if (receipt.attemptCount > receipt.limits.maxRetries + 1) {
    context.addIssue({
      code: "custom",
      message: "Attempt count exceeds the retry limit",
      path: ["attemptCount"],
    });
  }
  if (receipt.outcome === "completed" && receipt.attemptCount < 1) {
    context.addIssue({
      code: "custom",
      message: "Completed execution requires at least one attempt",
      path: ["attemptCount"],
    });
  }
  if (
    receipt.outcome === "completed" &&
    Number.isFinite(startedAtMs) &&
    Number.isFinite(finishedAtMs) &&
    finishedAtMs - startedAtMs > receipt.limits.wallTimeMs
  ) {
    context.addIssue({
      code: "custom",
      message: "Completed execution exceeded its wall-time limit",
      path: ["finishedAt"],
    });
  }
}

type ReceiptBase = z.infer<z.ZodObject<typeof ExecutionReceiptBaseShape>>;

function getReceiptFingerprintInput(receipt: ReceiptBase): ExecutionReceiptFingerprintInput {
  return {
    authentication: receipt.authentication ?? null,
    configurationId: receipt.configurationId,
    configurationRevision: receipt.configurationRevision,
    credentialReferenceIdentity: receipt.credentialReferenceIdentity ?? null,
    installationId: receipt.installationId ?? null,
    productId: receipt.productId,
    transportFamily: receipt.transportFamily,
    modelId: receipt.modelId,
    normalizedEndpoint: receipt.normalizedEndpoint ?? null,
    region: receipt.region ?? null,
    workspaceAccountReference: receipt.workspace ?? null,
    runtime: receipt.runtime ?? null,
    structuredOutputSchemaSha256: receipt.structuredOutputSchemaSha256,
    noticeVersion: receipt.noticeVersion,
    limits: receipt.limits,
  };
}

function validateReceipt(
  receipt: ReceiptBase & { outcome: TerminalOutcome },
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  const fingerprintInput = ExecutionReceiptFingerprintInputSchema.safeParse(
    getReceiptFingerprintInput(receipt),
  );
  if (fingerprintInput.success) {
    const expectedFingerprint = sha256CanonicalJsonSync(fingerprintInput.data);
    if (receipt.executionFingerprint !== expectedFingerprint) {
      context.addIssue({
        code: "custom",
        message: "Execution fingerprint does not match the immutable admitted receipt identity",
        path: ["executionFingerprint"],
      });
    }
  }
  validateReceiptUsage(receipt, context);
  validateReceiptTiming(receipt, context);
  validateReceiptIdentity(
    {
      authentication: receipt.authentication ?? null,
      credentialReferenceIdentity: receipt.credentialReferenceIdentity ?? null,
      installationId: receipt.installationId ?? null,
      modelId: receipt.modelId,
      normalizedEndpoint: receipt.normalizedEndpoint ?? null,
      productId: receipt.productId,
      region: receipt.region ?? null,
      runtime: receipt.runtime ?? null,
      transportFamily: receipt.transportFamily,
      workspaceAccountReference: receipt.workspace ?? null,
    },
    context,
  );
}

const CompletedExecutionReceiptSchema = z
  .strictObject({
    ...ExecutionReceiptBaseShape,
    outcome: z.literal("completed"),
  })
  .superRefine(validateReceipt)
  .readonly();

const FailedExecutionReceiptSchema = z
  .strictObject({
    ...ExecutionReceiptBaseShape,
    outcome: z.enum(FAILED_TERMINAL_OUTCOMES),
  })
  .superRefine(validateReceipt)
  .readonly();

export const ExecutionReceiptSchema = z.union([
  CompletedExecutionReceiptSchema,
  FailedExecutionReceiptSchema,
]);
export type ExecutionReceipt = z.infer<typeof ExecutionReceiptSchema>;

const EmptyReviewResultSchema = z.strictObject({ issues: z.tuple([]) });

export const ExecutionResultSchema = z.union([
  z
    .strictObject({
      receipt: CompletedExecutionReceiptSchema,
      result: ReviewResultSchema,
    })
    .readonly(),
  z
    .strictObject({
      receipt: FailedExecutionReceiptSchema,
      result: EmptyReviewResultSchema,
    })
    .readonly(),
]);
export type ExecutionResult = z.infer<typeof ExecutionResultSchema>;
