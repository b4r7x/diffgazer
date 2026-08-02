import type { LocalHttpProductId } from "@diffgazer/core/schemas/config";
import type { ExecutionResult } from "@diffgazer/core/schemas/review";
import { ReviewResultSchema } from "@diffgazer/core/schemas/review";
import { type BudgetLedger, createBudgetLedger } from "../budget/ledger.js";
import type { Adapter, AdapterExecuteRequest } from "../types.js";
import {
  conservativeAttemptEstimate,
  createCompletedExecutionResult,
  createFailedExecutionResult,
  type FailedTerminalOutcome,
  ZERO_ATTEMPT_ACTUAL,
} from "./execution-receipt.js";
import {
  discoverLocalHttpModels,
  generateLocalHttpObject,
  reviewResultJsonSchema,
} from "./local-http-discovery.js";
import {
  type LocalHttpAuth,
  localHttpTestDependencies,
  resolveLocalHttpDependencies,
} from "./local-http-request.js";

export type LocalHttpAdapterDependencies = Readonly<{
  resolveBearerToken?: (request: AdapterExecuteRequest) => Promise<string | null>;
}>;

async function resolveLocalHttpAuthForExecute(
  request: AdapterExecuteRequest,
  adapterDependencies?: LocalHttpAdapterDependencies,
): Promise<LocalHttpAuth> {
  const authentication = request.evidenceKey.authentication ?? "none";
  if (authentication !== "optional-local-bearer") {
    return { authentication, bearerToken: null };
  }

  const resolver =
    adapterDependencies?.resolveBearerToken ?? localHttpTestDependencies().resolveBearerToken;
  if (!resolver) {
    return { authentication, bearerToken: null };
  }

  return { authentication, bearerToken: await resolver(request) };
}

function createFailedResult(
  request: AdapterExecuteRequest,
  outcome: FailedTerminalOutcome,
  startedAt: string,
  finishedAt: string,
  attemptCount: number,
): ExecutionResult {
  return createFailedExecutionResult(request, outcome, { startedAt, finishedAt, attemptCount });
}

function createLocalHttpAdapter(
  productId: LocalHttpProductId,
  adapterDependencies?: LocalHttpAdapterDependencies,
): Adapter {
  return {
    productId,
    transportFamily: "local-http",
    async execute(request) {
      const { fetch: fetcher, now } = resolveLocalHttpDependencies();
      const startedAt = now().toISOString();

      if (request.evidenceKey.productId !== productId) {
        return createFailedResult(request, "transport-failed", startedAt, startedAt, 1);
      }

      if (request.signal?.aborted) {
        return createFailedResult(request, "cancelled", startedAt, startedAt, 1);
      }

      const limits = request.evidenceKey.limits;
      const ledger: BudgetLedger = createBudgetLedger(limits);
      const reservation = ledger.reserveAttempt(conservativeAttemptEstimate(limits));
      if (!reservation.ok) {
        return createFailedResult(
          request,
          reservation.error.outcome,
          startedAt,
          now().toISOString(),
          1,
        );
      }

      const releaseReservation = () => {
        ledger.releaseReservation(reservation.value);
      };

      try {
        const endpoint = request.evidenceKey.normalizedEndpoint;
        if (!endpoint) {
          releaseReservation();
          return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
        }

        const auth = await resolveLocalHttpAuthForExecute(request, adapterDependencies);

        const discovery = await discoverLocalHttpModels(
          { productId, endpoint, auth, signal: request.signal },
          { fetch: fetcher, now },
        );
        if (!discovery.ok) {
          releaseReservation();
          const outcome =
            request.signal?.aborted && discovery.error.code === "endpoint-unreachable"
              ? "cancelled"
              : "transport-failed";
          return createFailedResult(request, outcome, startedAt, now().toISOString(), 1);
        }

        if (discovery.value.runtime.version !== request.evidenceKey.runtime?.version) {
          releaseReservation();
          return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
        }

        if (
          !discovery.value.models.some((model) => model.modelId === request.evidenceKey.modelId)
        ) {
          releaseReservation();
          return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
        }

        const generation = await generateLocalHttpObject({
          productId,
          endpoint,
          modelId: request.evidenceKey.modelId,
          prompt: request.prompt,
          auth,
          fetcher,
          maxResponseBytes: limits.maxResponseBytes,
          deadlineMs: limits.wallTimeMs,
          schema: reviewResultJsonSchema(),
          signal: request.signal,
        });

        if (!generation.ok) {
          releaseReservation();
          return createFailedResult(
            request,
            generation.error.code,
            startedAt,
            now().toISOString(),
            1,
          );
        }

        const parsed = ReviewResultSchema.safeParse(generation.value);
        if (!parsed.success) {
          releaseReservation();
          return createFailedResult(request, "schema-failed", startedAt, now().toISOString(), 1);
        }

        const settle = ledger.settleAttempt(reservation.value, ZERO_ATTEMPT_ACTUAL);
        if (!settle.ok) {
          return createFailedResult(request, "budget-exhausted", startedAt, now().toISOString(), 1);
        }

        return createCompletedExecutionResult(request, parsed.data, {
          startedAt,
          finishedAt: now().toISOString(),
          attemptCount: 1,
        });
      } catch {
        releaseReservation();
        return createFailedResult(request, "transport-failed", startedAt, now().toISOString(), 1);
      }
    },
  };
}

export const ollamaAdapter = createLocalHttpAdapter("ollama");
export const localOpenaiAdapter = createLocalHttpAdapter("local-openai");
