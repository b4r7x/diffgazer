import type { LocalHttpProductId } from "@diffgazer/core/schemas/config";
import type { ExecutionResult } from "@diffgazer/core/schemas/review";
import { ReviewResultSchema } from "@diffgazer/core/schemas/review";
import { composeExecutionDeadline } from "../../deadline.js";
import type { Adapter, AdapterExecuteRequest } from "../../types.js";
import {
  createCompletedExecutionResult,
  createFailedExecutionResult,
  type FailedTerminalOutcome,
} from "../execution-receipt.js";
import {
  discoverAtResolvedEndpoint,
  generateLocalHttpObject,
  reviewResultJsonSchema,
} from "./discovery.js";
import {
  type LocalHttpAuth,
  type LocalHttpDependencies,
  resolveLocalHttpDependencies,
  resolveLocalHttpTransport,
} from "./request.js";
import { createAdmittedResponseByteBudget } from "./response-byte-budget.js";

async function resolveLocalHttpAuthForExecute(
  request: AdapterExecuteRequest,
): Promise<LocalHttpAuth> {
  const authentication = request.evidenceKey.authentication ?? "none";
  if (authentication !== "optional-local-bearer") {
    return { authentication, bearerToken: null };
  }

  return { authentication, bearerToken: (await request.resolveCredential?.()) ?? null };
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

export function createLocalHttpAdapter(
  productId: LocalHttpProductId,
  dependencies: LocalHttpDependencies = {},
): Adapter {
  return {
    productId,
    transportFamily: "local-http",
    async execute(request) {
      const resolved = resolveLocalHttpDependencies(dependencies);
      const { now } = resolved;
      const startedAt = now().toISOString();

      if (request.evidenceKey.productId !== productId) {
        return createFailedResult(request, "transport-failed", startedAt, startedAt, 1);
      }

      if (request.signal?.aborted) {
        return createFailedResult(request, "cancelled", startedAt, startedAt, 1);
      }

      // The per-review usage budget is owned by the execution spine (see
      // `ai/types.ts`); a second ledger here would double-reserve the same attempt.
      const limits = request.evidenceKey.limits;
      const responseByteBudget = createAdmittedResponseByteBudget(limits.maxResponseBytes);

      const finishWithFailure = (outcome: FailedTerminalOutcome): ExecutionResult =>
        createFailedResult(request, outcome, startedAt, now().toISOString(), 1);

      // Discovery, DNS resolution, model verification, and generation all spend
      // the same admitted wall time and response-byte envelope.
      const deadline = composeExecutionDeadline(limits.wallTimeMs, request.signal);
      const outcomeFor = (fallback: FailedTerminalOutcome): FailedTerminalOutcome => {
        if (deadline.expired()) return "timed-out";
        return deadline.signal.aborted ? "cancelled" : fallback;
      };

      try {
        const endpoint = request.evidenceKey.normalizedEndpoint;
        if (!endpoint) {
          return finishWithFailure("transport-failed");
        }

        const auth = await resolveLocalHttpAuthForExecute(request);

        const transport = await resolveLocalHttpTransport(endpoint, {
          ...resolved,
          signal: deadline.signal,
        });
        if (!transport.ok) {
          return finishWithFailure("transport-failed");
        }
        const boundEndpoint = transport.value.endpoint;
        const fetcher = transport.value.fetcher;

        const discovery = await discoverAtResolvedEndpoint(
          {
            productId,
            endpoint: boundEndpoint,
            auth,
            signal: deadline.signal,
            deadlineMs: deadline.remainingMs(),
            responseByteBudget,
          },
          fetcher,
        );
        if (!discovery.ok) {
          return finishWithFailure(outcomeFor("transport-failed"));
        }

        if (discovery.value.runtime.version !== request.evidenceKey.runtime?.version) {
          return finishWithFailure("transport-failed");
        }

        if (
          !discovery.value.models.some((model) => model.modelId === request.evidenceKey.modelId)
        ) {
          return finishWithFailure("transport-failed");
        }

        const generation = await generateLocalHttpObject({
          productId,
          endpoint: boundEndpoint,
          modelId: request.evidenceKey.modelId,
          prompt: request.prompt,
          ...(request.systemPrompt ? { systemPrompt: request.systemPrompt } : {}),
          auth,
          fetcher,
          maxResponseBytes: responseByteBudget.requestLimit(),
          maxOutputTokens: limits.maxOutputTokens,
          responseByteBudget,
          deadlineMs: deadline.remainingMs(),
          schema: reviewResultJsonSchema(),
          signal: deadline.signal,
        });

        if (!generation.ok) {
          return finishWithFailure(outcomeFor(generation.error.code));
        }

        const parsed = ReviewResultSchema.safeParse(generation.value);
        if (!parsed.success) {
          return finishWithFailure("schema-failed");
        }

        return createCompletedExecutionResult(request, parsed.data, {
          startedAt,
          finishedAt: now().toISOString(),
          attemptCount: 1,
        });
      } catch {
        return finishWithFailure("transport-failed");
      } finally {
        deadline.dispose();
      }
    },
  };
}

export const ollamaAdapter = createLocalHttpAdapter("ollama");
export const localOpenaiAdapter = createLocalHttpAdapter("local-openai");
