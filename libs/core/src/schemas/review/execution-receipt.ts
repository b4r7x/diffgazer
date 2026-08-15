import { type RefinementCtx, z } from "zod";
import { PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import { sha256CanonicalJsonSync } from "../canonical-json.js";
import {
  ConfigurationIdSchema,
  ConfigurationRevisionSchema,
  ExactModelIdSchema,
} from "../config/provider-config.js";
import {
  HostedApiEndpointSchema,
  LocalCliInstallationIdSchema,
  LocalHttpAuthenticationModeSchema,
  LoopbackHttpEndpointSchema,
  RunnableProductIdSchema,
  type TransportFamily,
  TransportFamilySchema,
} from "../config/transports.js";
import {
  addExecutionIdentityIssues,
  addModelIdentityIssue,
  type ExecutionLimits,
  ExecutionLimitsSchema,
  ExecutionNonnegativeIntegerSchema,
  ExecutionPositiveIntegerSchema,
  ExecutionSafeIdentitySchema,
  type RuntimeIdentity,
  RuntimeIdentitySchema,
  Sha256HexSchema,
} from "./execution-identity.js";
import {
  ExecutionMissingRequiredUsageStateShape,
  type ExecutionReceiptUsageState,
  ExecutionReportedUsageStateShape,
  ExecutionUnavailableUsageStateShape,
} from "./execution-usage.js";
import { ReviewResultSchema } from "./issues.js";

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
    credentialReferenceIdentity: Sha256HexSchema.nullable(),
    installationId: LocalCliInstallationIdSchema.nullable(),
    productId: RunnableProductIdSchema,
    transportFamily: TransportFamilySchema,
    modelId: ExactModelIdSchema,
    normalizedEndpoint: z.union([HostedApiEndpointSchema, LoopbackHttpEndpointSchema]).nullable(),
    region: ExecutionSafeIdentitySchema.nullable(),
    workspaceAccountReference: Sha256HexSchema.nullable(),
    runtime: RuntimeIdentitySchema.nullable(),
    structuredOutputSchemaSha256: Sha256HexSchema,
    noticeVersion: ExecutionPositiveIntegerSchema,
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
  credentialReferenceIdentity: Sha256HexSchema.nullable().optional(),
  installationId: LocalCliInstallationIdSchema.nullable().optional(),
  productId: RunnableProductIdSchema,
  transportFamily: TransportFamilySchema,
  modelId: ExactModelIdSchema,
  normalizedEndpoint: z
    .union([HostedApiEndpointSchema, LoopbackHttpEndpointSchema])
    .nullable()
    .optional(),
  region: ExecutionSafeIdentitySchema.nullable().optional(),
  workspaceAccountReference: Sha256HexSchema.nullable().optional(),
  runtime: RuntimeIdentitySchema.nullable().optional(),
  structuredOutputSchemaSha256: Sha256HexSchema,
  noticeVersion: ExecutionPositiveIntegerSchema,
  limits: ExecutionLimitsSchema,
  attemptCount: ExecutionNonnegativeIntegerSchema,
  startedAt: z.iso.datetime(),
  finishedAt: z.iso.datetime(),
} as const;

type ReceiptUsage = {
  limits: ExecutionLimits;
  outcome: TerminalOutcome;
  productId: z.infer<typeof RunnableProductIdSchema>;
} & ExecutionReceiptUsageState;

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
  receipt: ReceiptUsage,
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  if (receipt.usageAvailability === "reported" && receipt.outcome !== "budget-exhausted") {
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
type ReceiptUsageBase = ReceiptBase & ExecutionReceiptUsageState;

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
    workspaceAccountReference: receipt.workspaceAccountReference ?? null,
    runtime: receipt.runtime ?? null,
    structuredOutputSchemaSha256: receipt.structuredOutputSchemaSha256,
    noticeVersion: receipt.noticeVersion,
    limits: receipt.limits,
  };
}

function validateReceipt(
  receipt: ReceiptUsageBase & { outcome: TerminalOutcome },
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
      workspaceAccountReference: receipt.workspaceAccountReference ?? null,
    },
    context,
  );
}

function createExecutionReceiptVariant<
  TOutcome extends z.ZodType<TerminalOutcome>,
  TUsageShape extends Record<string, z.ZodType>,
>(outcome: TOutcome, usage: TUsageShape) {
  return z.strictObject({
    ...ExecutionReceiptBaseShape,
    outcome,
    ...usage,
  });
}

// The usage state is the receipt's own discriminant, exactly as
// `ExecutionReceiptUsageStateSchema` models it, so a malformed receipt reports
// the one branch that applies instead of every branch's errors.
const CompletedExecutionReceiptSchema = z
  .discriminatedUnion("usageAvailability", [
    createExecutionReceiptVariant(z.literal("completed"), ExecutionReportedUsageStateShape),
    createExecutionReceiptVariant(z.literal("completed"), ExecutionUnavailableUsageStateShape),
  ])
  .superRefine(validateReceipt)
  .readonly();

const FailedExecutionReceiptSchema = z
  .discriminatedUnion("usageAvailability", [
    createExecutionReceiptVariant(
      z.enum(FAILED_TERMINAL_OUTCOMES),
      ExecutionReportedUsageStateShape,
    ),
    createExecutionReceiptVariant(
      z.enum(FAILED_TERMINAL_OUTCOMES),
      ExecutionMissingRequiredUsageStateShape,
    ),
    createExecutionReceiptVariant(
      z.enum(FAILED_TERMINAL_OUTCOMES),
      ExecutionUnavailableUsageStateShape,
    ),
  ])
  .superRefine(validateReceipt)
  .readonly();

export const ExecutionReceiptSchema = z.discriminatedUnion("outcome", [
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
