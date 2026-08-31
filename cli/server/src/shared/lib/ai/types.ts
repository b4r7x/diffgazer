import type { AppError } from "@diffgazer/core/errors";
import type { Result } from "@diffgazer/core/result";
import type { RunnableProductId, TransportFamily } from "@diffgazer/core/schemas/config";
import type { SharedErrorCode } from "@diffgazer/core/schemas/errors";
import type { EvidenceKey, ExecutionResult } from "@diffgazer/core/schemas/review";
import { ExecutionResultSchema } from "@diffgazer/core/schemas/review";
import type { z } from "zod";
import type { SecretsStorageErrorCode } from "../config/types.js";
import type { BoundedDiagnostic } from "./diagnostics.js";

export type AIErrorCode =
  | SharedErrorCode
  | SecretsStorageErrorCode
  | "API_KEY_INVALID"
  | "MODEL_ERROR"
  | "NETWORK_ERROR"
  | "PARSE_ERROR"
  | "STREAM_ERROR"
  | "UNSUPPORTED_PROVIDER";

export type AIErrorDiagnostic = Pick<
  BoundedDiagnostic,
  "code" | "safeMessage" | "retryable" | "remediation" | "correlationId"
>;

export type AIError = AppError<AIErrorCode> & { diagnostic?: AIErrorDiagnostic };

/**
 * A non-terminal dispatch state worth showing while the answer is still
 * pending, and how long it lasts — a wait the caller can name beats a silent
 * one it can only guess at. Stale after `holdsForMs`: the dispatch has moved on.
 */
type DispatchProgress = Readonly<{ message: string; holdsForMs: number }>;

export type GenerateOptions = Readonly<{
  signal?: AbortSignal;
  systemPrompt?: string;
  onProgress?: (progress: DispatchProgress) => void;
}>;

/** A completed dispatch whose answer was incomplete: findings were recovered, candidates were dropped. */
export type GenerateWarning = Readonly<{
  droppedCandidateCount: number;
}>;

export type GenerateSuccess<T extends z.ZodType> = Readonly<{
  data: z.infer<T>;
  warning?: GenerateWarning;
}>;

export interface AIClient {
  readonly provider: RunnableProductId;
  generate<T extends z.ZodType>(
    prompt: string,
    schema: T,
    options?: GenerateOptions,
  ): Promise<Result<GenerateSuccess<T>, AIError>>;
}

/**
 * Budget ownership is split in two, and deliberately so:
 *
 * - The **attempt** budget is per dispatch. `evidenceKey.limits.maxRetries + 1`
 *   caps the attempts an adapter makes inside one `execute()` call, and the
 *   adapter enforces it.
 * - The **usage** budget (tokens, bytes, wall time, cost) is per review. The
 *   admitted `BudgetLedger` owned by the execution spine reserves at
 *   authorization and settles each dispatch against provider-reported usage.
 *   An adapter that retries therefore reports usage summed over every attempt it
 *   made: a discarded malformed response was still billed by the provider.
 *
 * The ledger is therefore not carried on this request. A review dispatches once
 * per lens while the spine holds the authorization's reservation for the whole
 * review, so a second ledger owner inside the adapter would double-reserve the
 * same attempt and exhaust `maxConcurrency` on the default budget.
 */
export interface AdapterExecuteRequest {
  readonly configurationId: string;
  readonly configurationRevision: number;
  readonly evidenceKey: EvidenceKey;
  readonly prompt: string;
  readonly systemPrompt?: string;
  readonly signal?: AbortSignal;
  /**
   * Server-only credential channel supplied by the authorized execution. It is
   * absent for unauthorized dispatch, which is why credential-bearing adapters
   * fail closed rather than reaching a provider without one.
   */
  readonly resolveCredential?: () => Promise<string | null>;
  /**
   * Sink for the bounded reason behind a failed attempt. The receipt records
   * only the terminal outcome, so an adapter that knows why the provider
   * refused the request reports it here and the review presents that instead
   * of a generic transport failure.
   */
  readonly reportDiagnostic?: (diagnostic: BoundedDiagnostic) => void;
  /** Sink for non-terminal waits — a rate-limit backoff, not a finished answer. */
  readonly reportProgress?: (progress: DispatchProgress) => void;
}

export interface Adapter {
  readonly productId: RunnableProductId;
  readonly transportFamily: TransportFamily;
  execute(request: AdapterExecuteRequest): Promise<ExecutionResult>;
}

export type AdapterRegistry = Record<RunnableProductId, Adapter>;

export function assertBoundedExecutionResult(result: ExecutionResult): ExecutionResult {
  if (result.receipt.outcome !== "completed" && result.result.issues.length > 0) {
    throw new Error("Non-completed adapter execution cannot emit findings");
  }
  return ExecutionResultSchema.parse(result);
}
