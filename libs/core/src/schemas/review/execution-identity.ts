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
  LOCAL_OPENAI_PRESET_ENDPOINTS,
  type LocalCliInstallationId,
  LocalCliInstallationIdSchema,
  LocalCliProductIdSchema,
  type LocalHttpAuthenticationMode,
  LocalHttpAuthenticationModeSchema,
  LocalHttpProductIdSchema,
  LoopbackHttpEndpointSchema,
  type RunnableProductId,
  type TransportFamily,
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
  authentication: LocalHttpAuthenticationMode | null;
  credentialReferenceIdentity: string | null;
  installationId: LocalCliInstallationId | null;
  normalizedEndpoint: string | null;
  productId: RunnableProductId;
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
      issues.push(...validateLocalHttpTuple(identity));
      break;
    case "local-cli":
      issues.push(...validateLocalCliTuple(identity));
      break;
  }

  issues.push(...validateRuntimeIdentity(identity));

  return issues;
}

export function addExecutionIdentityIssues(
  identity: ExecutionIdentity,
  context: Pick<RefinementCtx<unknown>, "addIssue">,
) {
  for (const issue of getExecutionIdentityIssues(identity)) addIssue(context, issue);
}

const HostedEvidenceKeySchema = z.strictObject({
  authentication: z.null(),
  credentialReferenceIdentity: Sha256HexSchema,
  installationId: z.null(),
  productId: HostedApiProductIdSchema,
  transportFamily: z.literal("hosted-api"),
  normalizedEndpoint: HostedApiEndpointSchema,
  region: ExecutionSafeIdentitySchema.nullable(),
  workspaceAccountReference: Sha256HexSchema.nullable(),
  modelId: ExactModelIdSchema,
  // Evidence is executable only when the runtime/server/CLI identity that was
  // probed is part of the immutable tuple.  Receipts keep this field optional
  // for terminal records produced before a runtime observation is available;
  // an admitted EvidenceKey cannot omit it.
  runtime: RuntimeIdentitySchema,
  structuredOutputSchemaSha256: Sha256HexSchema,
  noticeVersion: ExecutionPositiveIntegerSchema,
  limits: ExecutionLimitsSchema,
});

const LocalHttpEvidenceKeySchema = z.strictObject({
  authentication: LocalHttpAuthenticationModeSchema,
  credentialReferenceIdentity: Sha256HexSchema.nullable(),
  installationId: z.null(),
  productId: LocalHttpProductIdSchema,
  transportFamily: z.literal("local-http"),
  normalizedEndpoint: LoopbackHttpEndpointSchema,
  region: z.null(),
  workspaceAccountReference: z.null(),
  modelId: ExactModelIdSchema,
  runtime: RuntimeIdentitySchema,
  structuredOutputSchemaSha256: Sha256HexSchema,
  noticeVersion: ExecutionPositiveIntegerSchema,
  limits: ExecutionLimitsSchema,
});

const LocalCliEvidenceKeySchema = z.strictObject({
  authentication: z.null(),
  credentialReferenceIdentity: z.null(),
  installationId: LocalCliInstallationIdSchema,
  productId: LocalCliProductIdSchema,
  transportFamily: z.literal("local-cli"),
  normalizedEndpoint: z.null(),
  region: z.null(),
  workspaceAccountReference: z.null(),
  modelId: ExactModelIdSchema,
  runtime: RuntimeIdentitySchema,
  structuredOutputSchemaSha256: Sha256HexSchema,
  noticeVersion: ExecutionPositiveIntegerSchema,
  limits: ExecutionLimitsSchema,
});

export const EvidenceKeySchema = z
  .discriminatedUnion("transportFamily", [
    HostedEvidenceKeySchema,
    LocalHttpEvidenceKeySchema,
    LocalCliEvidenceKeySchema,
  ])
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
