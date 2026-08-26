import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { HOSTED_API_PRODUCT_IDS, type HostedApiProductId } from "@diffgazer/core/schemas/config";
import { type EvidenceKey, LensReviewResultSchema } from "@diffgazer/core/schemas/review";
import { readCachedLiveModelList } from "../../live-model-lists.js";
import type { Adapter, AdapterExecuteRequest } from "../../types.js";
import { createFailedExecutionResult } from "../execution-receipt.js";
import { executeHostedReview } from "./execute.js";
import { hostedStructuredOutputSchema } from "./profiles.js";
import type { HostedAdapterDependencies, HostedExecutionContext } from "./types.js";

export {
  boundedFetchInit,
  resolveHostedApiEndpoint as validateHostedEndpoint,
} from "../endpoints.js";
export { executeHostedReview } from "./execute.js";
export type {
  HostedAdapterDependencies,
  HostedExecuteRequest,
  HostedExecutionContext,
} from "./types.js";

/** The lens review schema every hosted generation validates its output against. */
export const DEFAULT_HOSTED_REVIEW_SCHEMA = LensReviewResultSchema;

function isHostedProductId(productId: EvidenceKey["productId"]): productId is HostedApiProductId {
  return HOSTED_API_PRODUCT_IDS.some((candidate) => candidate === productId);
}

/**
 * OpenRouter routes a request across downstream endpoints, and its strict
 * json_schema dispatch demands `structured_outputs` from every candidate
 * endpoint — a route that never declared it hard-404s instead of degrading.
 * The cached live model list already parses that per-route capability, so
 * dispatch keeps the strict schema only for routes that affirmatively declare
 * it and degrades every other route (declared refusal, unknown route, or a
 * cold cache) to JSON mode with local validation — degradation still reviews,
 * while a wrong strict demand cannot.
 */
function resolveOpenrouterDispatchOverrides(
  request: AdapterExecuteRequest,
): Pick<HostedExecutionContext, "structuredOutputMode" | "boundReasoning"> {
  if (request.evidenceKey.productId !== "openrouter") return {};
  const list = readCachedLiveModelList({
    configurationId: request.configurationId,
    productId: "openrouter",
  });
  const model = list?.models.find((candidate) => candidate.id === request.evidenceKey.modelId);
  return {
    ...(model?.structuredOutput === true
      ? {}
      : { structuredOutputMode: "json-object-local-validation" }),
    // A route that declares OpenRouter's `reasoning` control gets a bounded
    // reasoning budget on the wire, so a reasoning-default model cannot spend
    // its whole completion budget on thought and return no content. Routes
    // that never declared the control are left alone: sending it anyway would
    // narrow strict routing (require_parameters demands every parameter).
    ...(model?.reasoning === true ? { boundReasoning: true } : {}),
  };
}

const AUTHORIZED_HOSTED_DEPENDENCIES: HostedAdapterDependencies = {
  async resolveContext(request) {
    const credential = await request.resolveCredential?.();
    if (!credential) return null;
    if (!isHostedProductId(request.evidenceKey.productId)) return null;
    return {
      credential,
      reviewSchema: DEFAULT_HOSTED_REVIEW_SCHEMA,
      structuredOutputSchema: hostedStructuredOutputSchema(request.evidenceKey.productId),
      ...resolveOpenrouterDispatchOverrides(request),
    };
  },
};

export function createHostedAdapter(
  productId: HostedApiProductId,
  dependencies: HostedAdapterDependencies = AUTHORIZED_HOSTED_DEPENDENCIES,
): Adapter {
  const transportFamily = PRODUCT_REGISTRY[productId].transportFamily;
  return {
    productId,
    transportFamily,
    async execute(request) {
      if (
        request.evidenceKey.productId !== productId ||
        request.evidenceKey.transportFamily !== transportFamily
      ) {
        return createFailedExecutionResult(request, "transport-failed", {
          attemptCount: 0,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        });
      }

      const context = await dependencies.resolveContext(request);
      if (!context) {
        return createFailedExecutionResult(request, "transport-failed", {
          attemptCount: 0,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
        });
      }

      return executeHostedReview({ ...request, context });
    },
  };
}

export const HOSTED_ADAPTERS = Object.fromEntries(
  HOSTED_API_PRODUCT_IDS.map((productId) => [productId, createHostedAdapter(productId)]),
) as Record<HostedApiProductId, Adapter>;
