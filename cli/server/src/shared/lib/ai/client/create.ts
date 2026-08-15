import { createError } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import { CANDIDATE_PRODUCT_IDS, type RunnableProductId } from "@diffgazer/core/schemas/config";
import type { ExecutionResult } from "@diffgazer/core/schemas/review";
import {
  type AdmittedExecutionPlan,
  assertClientSafeAdmittedPlanSurface,
} from "../admission/service.js";
import { getAdapter, isForbiddenAdapterProductId } from "../providers/registry.js";
import type { AIError, AIErrorCode } from "../types.js";
import {
  type Adapter,
  type AdapterExecuteRequest,
  assertBoundedExecutionResult,
} from "../types.js";

export type AdmittedPlanClient = Readonly<{
  productId: RunnableProductId;
  modelId: string;
  transportFamily: AdmittedExecutionPlan["transportFamily"];
  configurationId: string;
  executionFingerprint: string;
  execute(
    prompt: string,
    options?: Readonly<{ signal?: AbortSignal; systemPrompt?: string }>,
  ): Promise<ExecutionResult>;
}>;

function isForbiddenPlanProductId(productId: string): boolean {
  return (
    isForbiddenAdapterProductId(productId) ||
    (CANDIDATE_PRODUCT_IDS as readonly string[]).includes(productId)
  );
}

function resolveRegistryAdapter(productId: RunnableProductId): Result<Adapter, AIError> {
  try {
    return ok(getAdapter(productId));
  } catch {
    return err(
      createError<AIErrorCode>(
        "UNSUPPORTED_PROVIDER",
        `No adapter is available for product "${productId}"`,
      ),
    );
  }
}

/**
 * The server-only half of an authorized execution: the adapter admission
 * already resolved and the credential resolver bound to its secret binding.
 * Absent for client-safe plan dispatch, which then carries no credential.
 */
export type AdmittedExecutionChannel = Readonly<{
  adapter: Adapter;
  resolveCredential: () => Promise<string | null>;
  workspaceAccountId?: string | null;
}>;

function buildExecuteRequest(
  plan: AdmittedExecutionPlan,
  prompt: string,
  options?: Readonly<{ signal?: AbortSignal; systemPrompt?: string }>,
  channel?: AdmittedExecutionChannel,
): AdapterExecuteRequest {
  return {
    configurationId: plan.configurationId,
    configurationRevision: plan.configurationRevision,
    evidenceKey: plan.evidenceKey,
    prompt,
    ...(options?.systemPrompt ? { systemPrompt: options.systemPrompt } : {}),
    signal: options?.signal,
    resolveCredential: channel?.resolveCredential,
    workspaceAccountId: channel?.workspaceAccountId ?? null,
  };
}

export function createFromAdmittedPlan(
  plan: AdmittedExecutionPlan,
  channel?: AdmittedExecutionChannel,
): Result<AdmittedPlanClient, AIError> {
  if (isForbiddenPlanProductId(plan.productId)) {
    return err(
      createError<AIErrorCode>(
        "UNSUPPORTED_PROVIDER",
        `Product "${plan.productId}" cannot execute reviews`,
      ),
    );
  }

  let adapter: Adapter;
  if (channel) {
    adapter = channel.adapter;
  } else {
    const adapterResult = resolveRegistryAdapter(plan.productId);
    if (!adapterResult.ok) {
      return err(adapterResult.error);
    }
    adapter = adapterResult.value;
  }

  if (adapter.productId !== plan.productId) {
    return err(
      createError<AIErrorCode>(
        "UNSUPPORTED_PROVIDER",
        "Adapter route does not match admitted plan product",
      ),
    );
  }

  if (adapter.transportFamily !== plan.transportFamily) {
    return err(
      createError<AIErrorCode>(
        "UNSUPPORTED_PROVIDER",
        "Adapter transport does not match admitted plan transport",
      ),
    );
  }

  assertClientSafeAdmittedPlanSurface(plan);

  const modelId = plan.evidenceKey.modelId;
  const client: AdmittedPlanClient = Object.freeze({
    productId: plan.productId,
    modelId,
    transportFamily: plan.transportFamily,
    configurationId: plan.configurationId,
    executionFingerprint: plan.executionFingerprint,
    execute: async (prompt, options) => {
      const result = await adapter.execute(buildExecuteRequest(plan, prompt, options, channel));
      return assertBoundedExecutionResult(result);
    },
  });

  return ok(client);
}
