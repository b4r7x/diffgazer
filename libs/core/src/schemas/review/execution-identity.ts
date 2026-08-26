import { type RefinementCtx, z } from "zod";
import { isModelIdAllowedForProduct, PRODUCT_REGISTRY } from "../../providers/product-registry.js";
import {
  ConfigurationIdSchema,
  ConfigurationRevisionSchema,
  ExactModelIdSchema,
} from "../config/provider-config.js";
import {
  HostedApiEndpointSchema,
  HostedApiProductIdSchema,
  type RunnableProductId,
} from "../config/transports.js";

const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;
export const Sha256HexSchema = z.string().regex(SHA256_HEX_PATTERN);

export const ExecutionPositiveIntegerSchema = z.number().int().positive();
export const ExecutionNonnegativeIntegerSchema = z.number().int().nonnegative();
export const ExecutionSafeIdentitySchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const ExecutionSafeVersionSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[A-Za-z0-9][A-Za-z0-9 ._:+()-]*$/);

export const ExecutionLimitsSchema = z
  .strictObject({
    maxInputTokens: ExecutionPositiveIntegerSchema,
    maxResponseBytes: ExecutionPositiveIntegerSchema,
    wallTimeMs: ExecutionPositiveIntegerSchema,
    maxRetries: ExecutionNonnegativeIntegerSchema,
    maxConcurrency: ExecutionPositiveIntegerSchema,
    maxCostUsd: z.number().nonnegative(),
  })
  .readonly();
export type ExecutionLimits = z.infer<typeof ExecutionLimitsSchema>;

export const RuntimeIdentitySchema = z
  .strictObject({
    identity: ExecutionSafeIdentitySchema,
    version: ExecutionSafeVersionSchema,
  })
  .readonly();
export type RuntimeIdentity = z.infer<typeof RuntimeIdentitySchema>;

type ExecutionIdentity = {
  credentialReferenceIdentity: string | null;
  normalizedEndpoint: string | null;
  productId: RunnableProductId;
  region: string | null;
  runtime: RuntimeIdentity | null;
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
function matchesProductModel(productId: RunnableProductId, modelId: string) {
  if (!ExactModelIdSchema.safeParse(modelId).success) return false;

  return isModelIdAllowedForProduct(productId, modelId);
}

export function addModelIdentityIssue(
  productId: RunnableProductId,
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

function getExecutionIdentityIssues(identity: ExecutionIdentity): ExecutionIdentityIssue[] {
  const issues: ExecutionIdentityIssue[] = [];
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
  if (endpoint === null || !HostedApiEndpointSchema.safeParse(endpoint).success) {
    issues.push({
      message: "Hosted execution requires a normalized HTTPS endpoint",
      path: ["normalizedEndpoint"],
    });
    return issues;
  }

  const matchingProfile = product.configuration.endpoints.find(
    (profile) => profile.endpoint === endpoint,
  );
  if (!matchingProfile) {
    issues.push({
      message: "Endpoint does not match the selected product transport tuple",
      path: ["normalizedEndpoint"],
    });
    return issues;
  }

  if (identity.region !== null) {
    issues.push({ message: "Hosted execution cannot record a region", path: ["region"] });
  }
  if (identity.workspaceAccountReference !== null) {
    issues.push({
      message: "Hosted execution cannot record a workspace or account reference",
      path: ["workspaceAccountReference"],
    });
  }

  return issues;
}

export function addExecutionIdentityIssues(
  identity: ExecutionIdentity,
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  for (const issue of getExecutionIdentityIssues(identity)) addIssue(context, issue);
}

// `authentication` and `installationId` were the local transports' slots; the
// nulls stay in the key so persisted fingerprints hash the same tuple.
export const EvidenceKeySchema = z
  .strictObject({
    authentication: z.null(),
    credentialReferenceIdentity: Sha256HexSchema,
    installationId: z.null(),
    productId: HostedApiProductIdSchema,
    transportFamily: z.literal("hosted-api"),
    normalizedEndpoint: HostedApiEndpointSchema,
    region: z.null(),
    workspaceAccountReference: z.null(),
    modelId: ExactModelIdSchema,
    // Evidence is executable only when the runtime/server identity that was
    // probed is part of the immutable tuple.  Receipts keep this field optional
    // for terminal records produced before a runtime observation is available;
    // an admitted EvidenceKey cannot omit it.
    runtime: RuntimeIdentitySchema,
    structuredOutputSchemaSha256: Sha256HexSchema,
    noticeVersion: ExecutionPositiveIntegerSchema,
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
