import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { HOSTED_API_PRODUCT_IDS, type HostedApiProductId } from "@diffgazer/core/schemas/config";
import type { ExecutionResult } from "@diffgazer/core/schemas/review";
import { resolveHostedApiEndpoint } from "../endpoints.js";
import { createFailedExecutionResult } from "../execution-receipt.js";
import { HOSTED_PROFILES } from "./profiles.js";
import type { HostedExecuteRequest, HostedProductProfile } from "./types.js";

/** Everything the attempt loop needs that only the admissibility guards can establish. */
type HostedPreflight = Readonly<{
  hostedProductId: HostedApiProductId;
  profile: HostedProductProfile;
  endpoint: string;
  credential: string;
  structuredOutputMode: HostedProductProfile["structuredOutput"];
  now: () => Date;
  startedAt: string;
}>;

export type HostedPreflightResult =
  | Readonly<{ ok: true; value: HostedPreflight }>
  | Readonly<{ ok: false; result: ExecutionResult }>;

function validateNoticeVersion(productId: HostedApiProductId, noticeVersion: number): boolean {
  return PRODUCT_REGISTRY[productId].notice.noticeVersion === noticeVersion;
}

/**
 * The admissibility gauntlet every hosted dispatch passes before a single
 * request is built. Every refusal is the same undiagnosed transport failure:
 * the tuple was never dispatchable, so there is nothing to report about it.
 */
export function validateHostedRequest(request: HostedExecuteRequest): HostedPreflightResult {
  const { evidenceKey, context } = request;
  const productId = evidenceKey.productId;
  const refuse = (now: () => Date, startedAt: string): HostedPreflightResult => ({
    ok: false,
    result: createFailedExecutionResult(request, "transport-failed", {
      attemptCount: 0,
      startedAt,
      finishedAt: now().toISOString(),
    }),
  });

  if (!(HOSTED_API_PRODUCT_IDS as readonly string[]).includes(productId)) {
    return refuse(() => new Date(), new Date().toISOString());
  }

  const hostedProductId = productId as HostedApiProductId;
  const profile: HostedProductProfile = HOSTED_PROFILES[hostedProductId];
  const now = context.now ?? (() => new Date());
  const startedAt = now().toISOString();

  if (evidenceKey.transportFamily !== "hosted-api") return refuse(now, startedAt);
  if (!validateNoticeVersion(hostedProductId, evidenceKey.noticeVersion)) {
    return refuse(now, startedAt);
  }

  const endpointResult = resolveHostedApiEndpoint({
    productId: hostedProductId,
    endpoint: evidenceKey.normalizedEndpoint ?? "",
  });
  if (!endpointResult.ok) return refuse(now, startedAt);
  if (!context.credential) return refuse(now, startedAt);

  const structuredOutputMode = context.structuredOutputMode ?? profile.structuredOutput;
  if (
    structuredOutputMode === "strict-json-schema" &&
    context.structuredOutputSchema === undefined
  ) {
    return refuse(now, startedAt);
  }

  return {
    ok: true,
    value: {
      hostedProductId,
      profile,
      endpoint: endpointResult.value.endpoint,
      credential: context.credential,
      structuredOutputMode,
      now,
      startedAt,
    },
  };
}
