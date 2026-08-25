import { createError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import type { ConfigurationId } from "@diffgazer/core/schemas/config";
import type { ExecutionResult, TerminalOutcome } from "@diffgazer/core/schemas/review";
import type { z } from "zod";
import { findSecretBinding } from "../../config/persistence/secrets.js";
import type { SecretBinding } from "../../config/secret-bindings.js";
import { resolveSecretBinding } from "../../config/secret-bindings.js";
import { secretIO } from "../../config/secret-io.js";
import { credentialReferenceIdentityFor } from "../../config/store/credential-lifecycle.js";
import { getStore } from "../../config/store.js";
import { V1_MIGRATION_FAILED_MESSAGE } from "../../config/types.js";
import { getConfigurationLeaseAuthority } from "../../session-registry.js";
import { RUNTIME_IDENTITY, STRUCTURED_OUTPUT_SCHEMA_SHA256 } from "../admission/protocol.js";
import type {
  AdmissionFailure,
  AdmissionServiceDependencies,
  AdmissionSnapshot,
  AuthorizedReviewExecution,
} from "../admission/service.js";
import { createBudgetLedger } from "../budget/ledger.js";
import type { BoundedDiagnostic } from "../diagnostics.js";
import type { AIClient, AIError, AIErrorCode, AIErrorDiagnostic } from "../types.js";
import { executeReviewGeneration } from "./generate.js";

export interface InitializedAIClient extends AIClient {
  readonly authorization?: AuthorizedReviewExecution;
  /**
   * Terminal adapter executions dispatched by this client, in completion order.
   * The review pipeline derives its terminal receipt (outcome and reported
   * usage) from them instead of re-deriving one from an error code.
   */
  readonly terminalExecutions: readonly ExecutionResult[];
  /** Safe, redacted diagnostics for terminal execution failures in completion order. */
  readonly terminalDiagnostics: readonly AIErrorDiagnostic[];
}

async function loadAdmissionSnapshot(
  configurationId: ConfigurationId,
): Promise<Result<AdmissionSnapshot | null, AdmissionFailure>> {
  const store = getStore();
  const current = await store.readCurrentState();
  if (!current.ok) return err(readinessFailure(current.error.code));
  const record = current.value.config.configurations.find((candidate) =>
    candidate.status === "unknown"
      ? candidate.configurationId === configurationId
      : candidate.record.configurationId === configurationId,
  );
  if (!record) return ok(null);

  if (record.status === "unknown") {
    return ok({
      configuration: { status: "unknown" },
      binding: null,
      evidence: null,
      credentialReferenceIdentity: null,
    });
  }

  const binding = findSecretBinding(
    current.value.secrets,
    record.record.configurationId,
    record.record.revision,
  );
  return ok({
    configuration: { status: "supported", record: record.record },
    binding,
    evidence: current.value.evidenceByConfiguration.get(configurationId) ?? null,
    credentialReferenceIdentity: binding ? credentialReferenceIdentityFor(binding) : null,
  });
}

function readinessFailure(code: string): AdmissionFailure {
  return code === "SECRETS_MIGRATION_FAILED"
    ? {
        code: "configuration-migration-required",
        safeMessage: V1_MIGRATION_FAILED_MESSAGE,
        retryable: false,
      }
    : {
        code: "readiness-not-ready",
        safeMessage: "Configuration storage is not ready",
        retryable: true,
      };
}

async function resolveCredentialForAdmission(input: {
  configurationId: string;
  configurationRevision: number;
  binding: SecretBinding | null;
}): Promise<string | null> {
  if (!input.binding) return null;
  return resolveSecretBinding(input.binding, secretIO, {
    configurationId: input.configurationId,
    revision: input.configurationRevision,
  });
}

/**
 * One dependency set — and therefore one budget ledger — per authorized
 * execution, sized by that configuration's own admitted limits. Nothing is
 * shared across configurations or across reviews.
 */
export function createAdmissionServiceDependencies(
  overrides: Partial<AdmissionServiceDependencies> = {},
): AdmissionServiceDependencies {
  return {
    loadSnapshot: loadAdmissionSnapshot,
    leaseRegistry: getConfigurationLeaseAuthority(),
    createBudgetLedger,
    structuredOutputSchemaSha256: STRUCTURED_OUTPUT_SCHEMA_SHA256,
    runtimeIdentity: RUNTIME_IDENTITY,
    resolveCredential: resolveCredentialForAdmission,
    ...overrides,
  };
}

export async function resolveSelectedConfigurationId(): Promise<
  Result<ConfigurationId | null, AdmissionFailure>
> {
  const current = await getStore().readCurrentState();
  return current.ok
    ? ok(current.value.config.selectedConfigurationId)
    : err(readinessFailure(current.error.code));
}

function toAIErrorDiagnostic(diagnostic: BoundedDiagnostic): AIErrorDiagnostic {
  return {
    code: diagnostic.code,
    safeMessage: diagnostic.safeMessage,
    retryable: diagnostic.retryable,
    remediation: diagnostic.remediation,
    correlationId: diagnostic.correlationId,
  };
}

function terminalOutcomeToAIError(
  outcome: TerminalOutcome,
  diagnostic?: AIErrorDiagnostic,
): AIError {
  return diagnostic
    ? {
        ...createError<AIErrorCode>("STREAM_ERROR", diagnostic.safeMessage),
        diagnostic,
      }
    : createError<AIErrorCode>("STREAM_ERROR", `Execution ended with outcome ${outcome}`);
}

function createGenerateBridge(
  authorization: AuthorizedReviewExecution,
  recordExecution: (execution: ExecutionResult, diagnostic?: AIErrorDiagnostic) => void,
): AIClient["generate"] {
  return async <T extends z.ZodType>(
    prompt: string,
    schema: T,
    options?: Readonly<{ signal?: AbortSignal; systemPrompt?: string }>,
  ): Promise<Result<z.infer<T>, AIError>> => {
    const { execution, diagnostic } = await executeReviewGeneration({
      authorization,
      prompt,
      ...(options?.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
      signal: options?.signal,
    });
    const terminalDiagnostic =
      execution.receipt.outcome === "completed" ? undefined : toAIErrorDiagnostic(diagnostic);
    recordExecution(execution, terminalDiagnostic);

    if (execution.receipt.outcome !== "completed") {
      return err(terminalOutcomeToAIError(execution.receipt.outcome, terminalDiagnostic));
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
  const terminalDiagnostics: AIErrorDiagnostic[] = [];
  return {
    provider: plan.productId,
    authorization,
    terminalExecutions,
    terminalDiagnostics,
    generate: createGenerateBridge(authorization, (execution, diagnostic) => {
      terminalExecutions.push(execution);
      if (diagnostic) {
        terminalDiagnostics.push(diagnostic);
      }
    }),
  };
}
