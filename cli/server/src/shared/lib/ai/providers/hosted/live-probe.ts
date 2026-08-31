/**
 * The opt-in live conformance probes: real requests to real provider endpoints,
 * gated behind an env opt-in and a credential. Kept apart from the offline case
 * tables in `conformance-cases.ts` so nothing here can run by accident.
 */
import { CREDENTIAL_ENV_VARS } from "@diffgazer/core/providers";
import { HOSTED_API_PRODUCT_IDS, type HostedApiProductId } from "@diffgazer/core/schemas/config";
import { z } from "zod";
import {
  defaultEndpoint,
  evidenceKeyFor,
  type HostedConformanceObservation,
  type HostedConformanceSkipReason,
  STRUCTURED_OUTPUT_SCHEMA,
  suggestedModelId,
} from "./conformance-cases.js";
import { DEFAULT_HOSTED_REVIEW_SCHEMA, executeHostedReview } from "./transport.js";

export const HOSTED_LIVE_PROBE_OPT_IN_ENV = "DIFFGAZER_LIVE_PROBES" as const;

export type HostedLiveProbeDescriptor = Readonly<{
  productId: HostedApiProductId;
  credentialEnv: string;
  /** Null when the product suggests no model; the live probe discovers one instead. */
  modelId: string | null;
  normalizedEndpoint?: string;
}>;

export function isHostedLiveProbeOptIn(): boolean {
  return process.env[HOSTED_LIVE_PROBE_OPT_IN_ENV] === "1";
}

export function reportHostedLiveSkipped(
  descriptor: HostedLiveProbeDescriptor,
  reason: HostedConformanceSkipReason,
): HostedConformanceObservation {
  return {
    status: "skipped",
    requirement: "REQ-084",
    caseId: `live:${descriptor.productId}`,
    productId: descriptor.productId,
    skipReason: reason,
    source: "live",
  };
}

export function resolveHostedLiveSkipReason(
  descriptor: HostedLiveProbeDescriptor,
): HostedConformanceSkipReason | null {
  if (!isHostedLiveProbeOptIn()) return "live-probes-disabled";
  if (!process.env[descriptor.credentialEnv]) return "credential-missing";
  return null;
}

export const HOSTED_LIVE_PROBE_DESCRIPTORS: readonly HostedLiveProbeDescriptor[] =
  HOSTED_API_PRODUCT_IDS.map((productId) => ({
    productId,
    credentialEnv: CREDENTIAL_ENV_VARS[productId],
    modelId: suggestedModelId(productId),
    normalizedEndpoint: defaultEndpoint(productId),
  }));

const LiveModelListSchema = z.object({
  data: z.array(z.object({ id: z.string().min(1) })).nonempty(),
});

/**
 * The first model the product's own `/models` list names, or null when the list
 * cannot be read — the caller reports that as a skip, never a failed probe,
 * because an unreadable list is a missing prerequisite and not a verdict.
 */
async function discoverLiveModelId(
  descriptor: HostedLiveProbeDescriptor,
  credential: string,
): Promise<string | null> {
  const endpoint = descriptor.normalizedEndpoint ?? defaultEndpoint(descriptor.productId);
  // Same pins as every credential-bearing list request in live-model-lists.ts:
  // a credential must never follow a 3xx to another host, and an unresponsive
  // provider must not hang the probe run open.
  const response = await globalThis
    .fetch(`${endpoint}/models`, {
      headers: { authorization: `Bearer ${credential}` },
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    })
    .catch(() => null);
  if (!response?.ok) return null;

  const body = await response.json().catch(() => null);
  const parsed = LiveModelListSchema.safeParse(body);
  return parsed.success ? (parsed.data.data[0]?.id ?? null) : null;
}

export async function runHostedLiveProbe(
  descriptor: HostedLiveProbeDescriptor,
): Promise<HostedConformanceObservation> {
  const skipReason = resolveHostedLiveSkipReason(descriptor);
  if (skipReason) {
    return reportHostedLiveSkipped(descriptor, skipReason);
  }

  // Narrowed rather than asserted: the skip gate above reads the same variable,
  // but nothing ties the two reads together for the compiler.
  const credential = process.env[descriptor.credentialEnv];
  if (!credential) {
    return reportHostedLiveSkipped(descriptor, "credential-missing");
  }

  const fetch = globalThis.fetch;
  const modelId = descriptor.modelId ?? (await discoverLiveModelId(descriptor, credential));
  if (modelId === null) {
    return reportHostedLiveSkipped(descriptor, "model-unresolved");
  }

  const evidenceKey = evidenceKeyFor(descriptor.productId, {
    modelId,
    ...(descriptor.normalizedEndpoint === undefined
      ? {}
      : { normalizedEndpoint: descriptor.normalizedEndpoint }),
  });

  const result = await executeHostedReview({
    configurationId: "live-conformance-configuration",
    configurationRevision: 1,
    evidenceKey,
    prompt: 'Return {"issues":[]} as JSON.',
    context: {
      credential,
      reviewSchema: DEFAULT_HOSTED_REVIEW_SCHEMA,
      structuredOutputSchema: STRUCTURED_OUTPUT_SCHEMA,
      fetch,
    },
  });

  const passed = result.receipt.outcome === "completed" && result.result.issues.length === 0;

  return {
    status: passed ? "passed" : "failed",
    requirement: "REQ-084",
    caseId: `live:${descriptor.productId}`,
    productId: descriptor.productId,
    outcome: result.receipt.outcome,
    attemptCount: result.receipt.attemptCount,
    findingsCount: result.result.issues.length,
    source: "live",
  };
}
