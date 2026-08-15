import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { HOSTED_API_PRODUCT_IDS, type HostedApiProductId } from "@diffgazer/core/schemas/config";
import { type EvidenceKey, LensReviewResultSchema } from "@diffgazer/core/schemas/review";
import type { Adapter } from "../../types.js";
import { createFailedExecutionResult } from "../execution-receipt.js";
import { executeHostedReview } from "./execute.js";
import { hostedStructuredOutputSchema } from "./profiles.js";
import type { HostedAdapterDependencies } from "./types.js";

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

const AUTHORIZED_HOSTED_DEPENDENCIES: HostedAdapterDependencies = {
  async resolveContext(request) {
    const credential = await request.resolveCredential?.();
    if (!credential) return null;
    if (!isHostedProductId(request.evidenceKey.productId)) return null;
    return {
      credential,
      reviewSchema: DEFAULT_HOSTED_REVIEW_SCHEMA,
      structuredOutputSchema: hostedStructuredOutputSchema(request.evidenceKey.productId),
      workspaceAccountId: request.workspaceAccountId ?? null,
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
