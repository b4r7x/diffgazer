import { createError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { ConfigurationId } from "@diffgazer/core/schemas/config";
import type {
  ExecutionLimits,
  ExecutionResult,
  RuntimeIdentity,
  TerminalOutcome,
} from "@diffgazer/core/schemas/review";
import { sha256CanonicalJsonSync } from "@diffgazer/core/schemas/review";
import type { z } from "zod";
import { loadConfigV2 } from "../../config/persistence/config.js";
import { loadSecretsV2 } from "../../config/persistence/secrets.js";
import type { SupportedProviderConfigurationRecord } from "../../config/provider-config.js";
import type { SecretBinding } from "../../config/secret-bindings.js";
import { resolveSecretBinding } from "../../config/secret-bindings.js";
import { getStore } from "../../config/store.js";
import { getConfigurationLeaseAuthority } from "../../session-registry.js";
import {
  type AdmissionFailure,
  type AdmissionServiceDependencies,
  type AdmissionSnapshot,
  type AuthorizedReviewExecution,
  authorizeReviewExecution,
  executionLimitsFromBudget,
} from "../admission/service.js";
import { createBudgetLedger } from "../budget/ledger.js";
import {
  buildReviewSchemaJson,
  hashReviewSchemaJson,
} from "../providers/cli-compatibility/probe.js";
import type { AIClient, AIError, AIErrorCode } from "../types.js";
import { createFromAdmittedPlan } from "./create.js";
import { executeReviewGeneration } from "./generate.js";

export interface InitializedAIClient extends AIClient {
  readonly authorization?: AuthorizedReviewExecution;
  /**
   * Terminal adapter executions dispatched by this client, in completion order.
   * The review pipeline derives its terminal receipt (outcome and reported
   * usage) from them instead of re-deriving one from an error code.
   */
  readonly terminalExecutions: readonly ExecutionResult[];
}

export const RUNTIME_IDENTITY: RuntimeIdentity = {
  identity: "diffgazer-server",
  version: "1.0.0",
};
export const STRUCTURED_OUTPUT_SCHEMA_SHA256 = hashReviewSchemaJson(buildReviewSchemaJson());

/**
 * Fail-closed limits for a configuration whose record cannot be resolved.
 * Admission rejects such a configuration before it reserves, so this ledger
 * only ever denies.
 */
const NO_ADMITTED_CAPACITY: ExecutionLimits = {
  maxInputTokens: 0,
  maxOutputTokens: 0,
  maxResponseBytes: 0,
  wallTimeMs: 0,
  maxRetries: 0,
  maxConcurrency: 0,
  maxCostUsd: 0,
};

function credentialReferenceIdentityFor(binding: SecretBinding | null): string | null {
  if (!binding) return null;
  switch (binding.kind) {
    case "none":
      return null;
    case "environment-reference":
      return sha256CanonicalJsonSync({ kind: "environment-reference", varName: binding.varName });
    case "keyring-reference":
      return sha256CanonicalJsonSync({ kind: "keyring-reference", keyId: binding.keyId });
    case "file-0600":
      return sha256CanonicalJsonSync({ kind: "file-0600", filePath: binding.filePath });
    case "optional-local-bearer":
      return sha256CanonicalJsonSync({
        kind: "optional-local-bearer",
        storage: binding.storage,
        reference: binding.reference,
      });
  }
}

function workspaceAccountReferenceFor(record: SupportedProviderConfigurationRecord): string | null {
  if (record.input.transportFamily !== "hosted-api" || record.input.workspace === undefined) {
    return null;
  }
  return sha256CanonicalJsonSync(record.input.workspace);
}

function bindingFor(configurationId: ConfigurationId, revision: number): SecretBinding | null {
  for (const entry of loadSecretsV2().bindings) {
    const binding = entry.binding;
    if (binding && binding.configurationId === configurationId && binding.revision === revision) {
      return binding;
    }
  }
  return null;
}

async function loadAdmissionSnapshot(
  configurationId: ConfigurationId,
): Promise<AdmissionSnapshot | null> {
  const store = getStore();
  await store.ready();

  const config = loadConfigV2();
  const record = config.configurations.find((candidate) =>
    candidate.status === "unknown"
      ? candidate.configurationId === configurationId
      : candidate.record.configurationId === configurationId,
  );
  if (!record) return null;

  if (record.status === "unknown") {
    return {
      configuration: { status: "unknown" },
      binding: null,
      evidence: null,
      credentialReferenceIdentity: null,
      workspaceAccountReference: null,
    };
  }

  const binding = bindingFor(record.record.configurationId, record.record.revision);
  return {
    configuration: { status: "supported", record: record.record },
    binding,
    evidence: store.getConfigurationAdmissionEvidence(configurationId),
    credentialReferenceIdentity: binding ? credentialReferenceIdentityFor(binding) : null,
    workspaceAccountReference: workspaceAccountReferenceFor(record.record),
  };
}

async function resolveCredentialForAdmission(input: {
  configurationId: string;
  configurationRevision: number;
  binding: SecretBinding | null;
}): Promise<string | null> {
  if (!input.binding) return null;
  return resolveSecretBinding(input.binding, undefined, {
    configurationId: input.configurationId,
    revision: input.configurationRevision,
  });
}

function admittedLimitsFor(configurationId: ConfigurationId | null): ExecutionLimits {
  if (!configurationId) return NO_ADMITTED_CAPACITY;
  const record = loadConfigV2().configurations.find(
    (candidate) =>
      candidate.status === "supported" && candidate.record.configurationId === configurationId,
  );
  return record?.status === "supported"
    ? executionLimitsFromBudget(record.record.budget)
    : NO_ADMITTED_CAPACITY;
}

/**
 * One dependency set — and therefore one budget ledger — per authorized
 * execution, sized by that configuration's own admitted limits. Nothing is
 * shared across configurations or across reviews.
 */
export function createAdmissionServiceDependencies(
  configurationId: ConfigurationId | null = resolveSelectedConfigurationId(),
  overrides: Partial<AdmissionServiceDependencies> = {},
): AdmissionServiceDependencies {
  return {
    loadSnapshot: loadAdmissionSnapshot,
    leaseRegistry: getConfigurationLeaseAuthority(),
    budgetLedger: createBudgetLedger(admittedLimitsFor(configurationId)),
    structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
    runtimeIdentity: RUNTIME_IDENTITY,
    resolveCredential: resolveCredentialForAdmission,
    ...overrides,
  };
}

export function resolveSelectedConfigurationId(): ConfigurationId | null {
  return loadConfigV2().selectedConfigurationId;
}

function terminalOutcomeToAIError(outcome: TerminalOutcome): AIError {
  return createError<AIErrorCode>("STREAM_ERROR", `Execution ended with outcome ${outcome}`);
}

function createGenerateBridge(
  authorization: AuthorizedReviewExecution,
  recordExecution: (execution: ExecutionResult) => void,
): AIClient["generate"] {
  return async <T extends z.ZodType>(
    prompt: string,
    schema: T,
    options?: Readonly<{ signal?: AbortSignal }>,
  ): Promise<Result<z.infer<T>, AIError>> => {
    const { execution } = await executeReviewGeneration({
      authorization,
      prompt,
      signal: options?.signal,
    });
    recordExecution(execution);

    if (execution.receipt.outcome !== "completed") {
      return err(terminalOutcomeToAIError(execution.receipt.outcome));
    }

    const parsed = schema.safeParse(execution.result);
    if (!parsed.success) {
      return err(
        createError<AIErrorCode>("PARSE_ERROR", "Adapter response failed schema validation"),
      );
    }

    return ok(parsed.data);
  };
}

export function toInitializedAIClient(
  authorization: AuthorizedReviewExecution,
): InitializedAIClient {
  const { plan } = authorization;
  const terminalExecutions: ExecutionResult[] = [];
  return {
    provider: plan.productId,
    authorization,
    terminalExecutions,
    generate: createGenerateBridge(authorization, (execution) =>
      terminalExecutions.push(execution),
    ),
  };
}

export async function initializeAIClient(
  configurationId: ConfigurationId,
  dependencies: AdmissionServiceDependencies = createAdmissionServiceDependencies(configurationId),
): Promise<Result<InitializedAIClient, AdmissionFailure>> {
  const authorization = await authorizeReviewExecution(configurationId, dependencies);
  if (!authorization.ok) {
    return authorization;
  }

  const clientResult = createFromAdmittedPlan(authorization.value.plan, {
    adapter: authorization.value.adapter,
    resolveCredential: authorization.value.resolveCredential,
    workspaceAccountId: authorization.value.workspaceAccountId,
  });
  if (!clientResult.ok) {
    return err({
      code: "adapter-unavailable",
      safeMessage: clientResult.error.message,
      retryable: false,
    });
  }

  return ok(toInitializedAIClient(authorization.value));
}
