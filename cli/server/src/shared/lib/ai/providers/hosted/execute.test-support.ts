import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import type { EvidenceKey } from "@diffgazer/core/schemas/review";
import { vi } from "vitest";
import { DEFAULT_HOSTED_REVIEW_SCHEMA } from "./transport.js";

export type FetchFn = typeof globalThis.fetch;
export type MockFetchFn = ReturnType<typeof vi.fn<FetchFn>>;
export type HostedEvidenceKey = Extract<EvidenceKey, { transportFamily: "hosted-api" }>;

const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
export const TEST_CREDENTIAL = "sk-test-hosted-credential-value";

export const STRUCTURED_OUTPUT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    issues: {
      type: "array",
      items: { type: "object" },
    },
  },
  required: ["issues"],
} as const;

export const limits = {
  maxInputTokens: 20_000,
  maxResponseBytes: 1_048_576,
  wallTimeMs: 120_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 0.5,
} as const;

export function suggestedModelId(productId: HostedApiProductId): string {
  const policy = PRODUCT_REGISTRY[productId].modelPolicy;
  if ("suggestedModelId" in policy && policy.suggestedModelId) {
    return policy.suggestedModelId;
  }
  if (productId === "openrouter") return "anthropic/claude-3.7-sonnet";
  return "model-1";
}

export function evidenceKeyFor(
  productId: HostedApiProductId,
  patch: Partial<HostedEvidenceKey> = {},
): EvidenceKey {
  const product = PRODUCT_REGISTRY[productId];
  const endpoint = product.configuration.endpoints[0];

  return {
    authentication: null,
    credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
    installationId: null,
    productId,
    transportFamily: "hosted-api",
    normalizedEndpoint: endpoint?.endpoint ?? "https://example.invalid/v1",
    region: null,
    workspaceAccountReference: null,
    modelId: suggestedModelId(productId),
    runtime: { identity: "diffgazer-server", version: "1.2.3" },
    structuredOutputSchemaSha256: SCHEMA_SHA256,
    noticeVersion: product.notice.noticeVersion,
    limits,
    ...patch,
  };
}

export function openAiSuccessBody(content: unknown, usage?: Record<string, number>) {
  return {
    choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }],
    usage: usage ?? { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
  };
}

export function googleSuccessBody(content: unknown, usage?: Record<string, number>) {
  return {
    candidates: [
      {
        content: { parts: [{ text: JSON.stringify(content) }] },
        finishReason: "STOP",
      },
    ],
    usageMetadata: usage ?? {
      promptTokenCount: 12,
      candidatesTokenCount: 8,
      totalTokenCount: 20,
    },
  };
}

export function mockFetchResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string>; redirected?: boolean } = {},
): FetchFn {
  return vi.fn(async () => {
    const payload = typeof body === "string" ? body : JSON.stringify(body);
    const response = new Response(payload, {
      status: init.status ?? 200,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    });
    if (init.redirected) {
      Object.defineProperty(response, "redirected", { value: true });
    }
    return response;
  }) as FetchFn;
}

export function executeRequest(
  productId: HostedApiProductId,
  patch: Partial<HostedEvidenceKey> = {},
) {
  return {
    configurationId: "configuration-1",
    configurationRevision: 3,
    evidenceKey: evidenceKeyFor(productId, patch),
    prompt: "review this diff",
  };
}

export function hostedContext(fetch: FetchFn) {
  return {
    credential: TEST_CREDENTIAL,
    reviewSchema: DEFAULT_HOSTED_REVIEW_SCHEMA,
    structuredOutputSchema: STRUCTURED_OUTPUT_SCHEMA,
    fetch,
  };
}

export function requestBodyAt(fetch: FetchFn, index: number): Record<string, unknown> {
  const init = (fetch as MockFetchFn).mock.calls[index]?.[1];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}
