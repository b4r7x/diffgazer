import type { AppError } from "@diffgazer/core/errors";
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { Result } from "@diffgazer/core/result";
import type { RunnableProductId, TransportFamily } from "@diffgazer/core/schemas/config";
import type { SharedErrorCode } from "@diffgazer/core/schemas/errors";
import type { EvidenceKey, ExecutionResult } from "@diffgazer/core/schemas/review";
import { ExecutionResultSchema } from "@diffgazer/core/schemas/review";
import type { z } from "zod";
import type { AIProvider, SecretsStorageErrorCode } from "../config/types.js";

export type AIErrorCode =
  | SharedErrorCode
  | SecretsStorageErrorCode
  | "API_KEY_INVALID"
  | "MODEL_ERROR"
  | "NETWORK_ERROR"
  | "PARSE_ERROR"
  | "STREAM_ERROR"
  | "UNSUPPORTED_PROVIDER";

export type AIError = AppError<AIErrorCode>;

export interface AIClientConfig {
  apiKey: string;
  provider: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  maxRetries?: number;
  timeoutMs?: number;
  /** The selected model's documented output-token limit, when known from the catalog. */
  outputLimit?: number;
  /** The selected model's documented context-window limit, when known from the catalog. */
  contextLimit?: number;
}

export interface AIClient {
  readonly provider: AIProvider;
  generate<T extends z.ZodType>(
    prompt: string,
    schema: T,
    options?: { signal?: AbortSignal },
  ): Promise<Result<z.infer<T>, AIError>>;
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
  readonly signal?: AbortSignal;
  /**
   * Server-only credential channel supplied by the authorized execution. It is
   * absent for unauthorized dispatch, which is why credential-bearing adapters
   * fail closed rather than reaching a provider without one.
   */
  readonly resolveCredential?: () => Promise<string | null>;
  /**
   * Workspace account literal for workspace-bound hosted endpoints, supplied by
   * the same authorized execution. The evidence key carries only its hash.
   */
  readonly workspaceAccountId?: string | null;
}

export interface Adapter {
  readonly productId: RunnableProductId;
  readonly transportFamily: TransportFamily;
  execute(request: AdapterExecuteRequest): Promise<ExecutionResult>;
}

export type AdapterRegistry = Record<RunnableProductId, Adapter>;

export type SafeAdapterIdentity = Readonly<{
  productId: RunnableProductId;
  transportFamily: TransportFamily;
}>;

export type SafeAdapterProductNotice = Readonly<{
  productId: RunnableProductId;
  noticeId: string;
  noticeVersion: number;
  privacy: readonly string[];
  billing: readonly string[];
}>;

export function getSafeAdapterIdentity(adapter: Adapter): SafeAdapterIdentity {
  return {
    productId: adapter.productId,
    transportFamily: adapter.transportFamily,
  };
}

export function getSafeAdapterProductNotice(
  productId: RunnableProductId,
): SafeAdapterProductNotice {
  const product = PRODUCT_REGISTRY[productId];
  return {
    productId,
    noticeId: product.notice.id,
    noticeVersion: product.notice.noticeVersion,
    privacy: product.notice.privacy,
    billing: product.notice.billing,
  };
}

export function assertBoundedExecutionResult(result: ExecutionResult): ExecutionResult {
  if (result.receipt.outcome !== "completed" && result.result.issues.length > 0) {
    throw new Error("Non-completed adapter execution cannot emit findings");
  }
  return ExecutionResultSchema.parse(result);
}
