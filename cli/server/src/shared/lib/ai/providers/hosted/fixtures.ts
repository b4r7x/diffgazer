import { PRODUCT_REGISTRY, resolveCredentialEnvironmentVariable } from "@diffgazer/core/providers";
import { HOSTED_API_PRODUCT_IDS, type HostedApiProductId } from "@diffgazer/core/schemas/config";
import type { EvidenceKey, TerminalOutcome } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import {
  DEFAULT_HOSTED_REVIEW_SCHEMA,
  executeHostedReview,
  type HostedExecutionContext,
} from "./transport.js";

export const HOSTED_LIVE_PROBE_OPT_IN_ENV = "DIFFGAZER_LIVE_PROBES" as const;

type HostedConformanceRequirement = "REQ-084" | "REQ-085" | "REQ-086";

export type HostedConformanceSkipReason =
  | "live-probes-disabled"
  | "credential-missing"
  | "network-unavailable"
  | "entitlement-missing";

export type HostedConformanceObservation = Readonly<{
  status: "passed" | "failed" | "skipped";
  requirement: HostedConformanceRequirement;
  caseId: string;
  productId: HostedApiProductId;
  outcome?: TerminalOutcome;
  attemptCount?: number;
  usageAvailability?: string;
  findingsCount?: number;
  /** Endpoint origin the adapter actually requested, observed from the injected fetch. */
  requestedEndpoint?: string;
  skipReason?: HostedConformanceSkipReason;
  source: "mock" | "live";
}>;

export type HostedMockConformanceCase = Readonly<{
  id: string;
  requirement: HostedConformanceRequirement;
  productId: HostedApiProductId;
  evidencePatch?: Partial<Extract<EvidenceKey, { transportFamily: "hosted-api" }>>;
  prompt?: string;
  workspaceAccountId?: string | null;
  aborted?: boolean;
  limitsPatch?: Partial<EvidenceKey["limits"]>;
  fetch: typeof fetch;
  expectedOutcome: TerminalOutcome;
  expectedAttemptCount?: number;
  /** Findings the completed case must return; a non-completed outcome must return none. */
  expectedFindingsCount?: number;
  expectedUsageAvailability?: string;
  /** Endpoint the case requires the adapter to call; asserts regional routing. */
  expectedEndpoint?: string;
}>;

export type HostedLiveProbeDescriptor = Readonly<{
  productId: HostedApiProductId;
  credentialEnv: string;
  modelId: string;
  region?: string | null;
  normalizedEndpoint?: string;
  workspaceAccountId?: string | null;
  requiresEntitlement?: boolean;
}>;

const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
const WORKSPACE_ACCOUNT_REFERENCE = "4".repeat(64);
const TEST_CREDENTIAL = "hosted-conformance-synthetic-credential";

const STRUCTURED_OUTPUT_SCHEMA = {
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

const DEFAULT_LIMITS = {
  maxInputTokens: 20_000,
  maxOutputTokens: 4_000,
  maxResponseBytes: 1_048_576,
  wallTimeMs: 120_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 0.5,
} as const;

const LONG_DIFF_PROMPT = `Review this diff:\n${"@@ -1,1 +1,1 @@\n-old\n+new\n".repeat(400)}`;

function suggestedModelId(productId: HostedApiProductId): string {
  const policy = PRODUCT_REGISTRY[productId].modelPolicy;
  if ("suggestedModelId" in policy && policy.suggestedModelId) {
    return policy.suggestedModelId;
  }
  if (productId === "openrouter") return "anthropic/claude-3.7-sonnet";
  if (productId === "moonshot") return "kimi-k3-2026-01";
  return "model-1";
}

function defaultEndpoint(productId: HostedApiProductId, region?: string | null): string {
  const endpoints = PRODUCT_REGISTRY[productId].configuration.endpoints;
  if (region) {
    const match = endpoints.find((entry) => "region" in entry && entry.region === region);
    if (match) return match.endpoint;
  }
  return endpoints[0]?.endpoint ?? "https://example.invalid/v1";
}

function evidenceKeyFor(
  productId: HostedApiProductId,
  patch: Partial<Extract<EvidenceKey, { transportFamily: "hosted-api" }>> = {},
): EvidenceKey {
  const product = PRODUCT_REGISTRY[productId];
  const endpoint = product.configuration.endpoints[0];
  const region = endpoint && "region" in endpoint ? (endpoint.region ?? null) : null;
  const workspaceAccountReference =
    endpoint && "workspaceBound" in endpoint && endpoint.workspaceBound
      ? WORKSPACE_ACCOUNT_REFERENCE
      : null;

  return {
    authentication: null,
    credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
    installationId: null,
    productId,
    transportFamily: "hosted-api",
    normalizedEndpoint: endpoint?.endpoint ?? "https://example.invalid/v1",
    region,
    workspaceAccountReference,
    modelId: suggestedModelId(productId),
    runtime: { identity: "diffgazer-server", version: "1.2.3" },
    structuredOutputSchemaSha256: SCHEMA_SHA256,
    noticeVersion: product.notice.noticeVersion,
    limits: DEFAULT_LIMITS,
    ...patch,
  };
}

function openAiBody(content: unknown, usage?: Record<string, number>) {
  return {
    choices: [{ message: { content: JSON.stringify(content) }, finish_reason: "stop" }],
    usage: usage ?? { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
  };
}

function googleBody(content: unknown, usage?: Record<string, number>) {
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

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function mockResponse(
  body: unknown,
  init: { status?: number; headers?: Record<string, string>; redirected?: boolean } = {},
): Response {
  const payload = typeof body === "string" ? body : JSON.stringify(body);
  const response = new Response(payload, {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...(init.headers ?? {}) },
  });
  if (init.redirected) {
    Object.defineProperty(response, "redirected", { value: true });
  }
  return response;
}

function successFetch(productId: HostedApiProductId, content: unknown): typeof fetch {
  const body = productId === "gemini" ? googleBody(content) : openAiBody(content);
  return (async () => mockResponse(body)) as typeof fetch;
}

function hostedContext(
  fetchFn: typeof fetch,
  patch: Record<string, unknown> = {},
): HostedExecutionContext {
  return {
    credential: TEST_CREDENTIAL,
    reviewSchema: DEFAULT_HOSTED_REVIEW_SCHEMA,
    structuredOutputSchema: STRUCTURED_OUTPUT_SCHEMA,
    fetch: fetchFn,
    ...patch,
  };
}

export function isHostedLiveProbeOptIn(): boolean {
  return process.env[HOSTED_LIVE_PROBE_OPT_IN_ENV] === "1";
}

export function canProduceReadyEvidence(observation: HostedConformanceObservation): boolean {
  if (observation.source === "mock") return false;
  if (observation.status === "skipped") return false;
  return observation.status === "passed" && observation.outcome === "completed";
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
  if (descriptor.requiresEntitlement && !descriptor.workspaceAccountId)
    return "entitlement-missing";
  return null;
}

export async function runHostedMockConformanceCase(
  testCase: HostedMockConformanceCase,
): Promise<HostedConformanceObservation> {
  const evidenceKey = evidenceKeyFor(testCase.productId, testCase.evidencePatch ?? {});
  const controller = new AbortController();
  if (testCase.aborted) controller.abort();

  let requestedEndpoint: string | undefined;
  const observingFetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    requestedEndpoint ??= new URL(requestUrl(input)).origin;
    return testCase.fetch(input, init);
  }) as typeof fetch;

  const result = await executeHostedReview({
    configurationId: "conformance-configuration",
    configurationRevision: 1,
    evidenceKey: {
      ...evidenceKey,
      ...(testCase.limitsPatch
        ? { limits: { ...evidenceKey.limits, ...testCase.limitsPatch } }
        : {}),
    },
    prompt: testCase.prompt ?? "review this diff",
    signal: controller.signal,
    context: hostedContext(observingFetch, {
      workspaceAccountId: testCase.workspaceAccountId,
    }),
  });

  const findingsCount = result.result.issues.length;
  const findingsAsExpected =
    testCase.expectedOutcome === "completed"
      ? testCase.expectedFindingsCount === undefined ||
        findingsCount === testCase.expectedFindingsCount
      : findingsCount === 0;

  const passed =
    result.receipt.outcome === testCase.expectedOutcome &&
    findingsAsExpected &&
    (testCase.expectedAttemptCount === undefined ||
      result.receipt.attemptCount === testCase.expectedAttemptCount) &&
    (testCase.expectedUsageAvailability === undefined ||
      result.receipt.usageAvailability === testCase.expectedUsageAvailability) &&
    (testCase.expectedEndpoint === undefined ||
      requestedEndpoint === new URL(testCase.expectedEndpoint).origin);

  return {
    status: passed ? "passed" : "failed",
    requirement: testCase.requirement,
    caseId: testCase.id,
    productId: testCase.productId,
    outcome: result.receipt.outcome,
    attemptCount: result.receipt.attemptCount,
    usageAvailability: result.receipt.usageAvailability,
    findingsCount,
    requestedEndpoint,
    source: "mock",
  };
}

const mistralNullableReview = {
  issues: [
    {
      id: "mistral-nullable-1",
      severity: "low",
      category: "style",
      title: "Nullable field probe",
      file: "src/example.ts",
      line_start: null,
      line_end: null,
      rationale: "Probe nullable line numbers.",
      recommendation: "Keep explicit nulls when unknown.",
      suggested_patch: null,
      confidence: 0.4,
      symptom: "Nullable probe",
      whyItMatters: "Conformance must accept explicit nulls.",
      evidence: [],
    },
  ],
};

export const HOSTED_REQ_084_CASES: readonly HostedMockConformanceCase[] = [
  {
    id: "REQ-084:invalid-credential",
    requirement: "REQ-084",
    productId: "groq",
    fetch: (async () =>
      mockResponse({ error: "invalid_api_key" }, { status: 401 })) as typeof fetch,
    expectedOutcome: "transport-failed",
  },
  {
    id: "REQ-084:missing-model",
    requirement: "REQ-084",
    productId: "groq",
    fetch: (async () =>
      mockResponse({ error: "model_not_found" }, { status: 404 })) as typeof fetch,
    expectedOutcome: "transport-failed",
  },
  {
    id: "REQ-084:rate-limit",
    requirement: "REQ-084",
    productId: "groq",
    fetch: (async () => mockResponse({ error: "rate limited" }, { status: 429 })) as typeof fetch,
    expectedOutcome: "transport-failed",
  },
  {
    id: "REQ-084:malformed-response",
    requirement: "REQ-084",
    productId: "groq",
    fetch: (async () =>
      mockResponse({
        choices: [{ message: { content: "not-json" }, finish_reason: "stop" }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      })) as typeof fetch,
    expectedOutcome: "schema-failed",
  },
  {
    id: "REQ-084:redirect",
    requirement: "REQ-084",
    productId: "groq",
    fetch: (async () => {
      throw new TypeError("redirect mode is error");
    }) as typeof fetch,
    expectedOutcome: "transport-failed",
  },
  {
    id: "REQ-084:oversized-response",
    requirement: "REQ-084",
    productId: "groq",
    limitsPatch: { maxResponseBytes: 256 },
    fetch: (async () =>
      mockResponse(openAiBody({ issues: [], filler: "x".repeat(2_048) }))) as typeof fetch,
    expectedOutcome: "transport-failed",
  },
  {
    id: "REQ-084:cancellation",
    requirement: "REQ-084",
    productId: "groq",
    aborted: true,
    fetch: successFetch("groq", { issues: [] }),
    expectedOutcome: "cancelled",
  },
  {
    id: "REQ-084:provider-failure",
    requirement: "REQ-084",
    productId: "groq",
    fetch: (async () =>
      mockResponse({ error: "upstream unavailable" }, { status: 503 })) as typeof fetch,
    expectedOutcome: "transport-failed",
  },
  {
    id: "REQ-084:valid-http-json-without-review-schema",
    requirement: "REQ-084",
    productId: "groq",
    fetch: (async () => mockResponse({ ok: true, data: { status: "healthy" } })) as typeof fetch,
    expectedOutcome: "schema-failed",
  },
];

function malformedRetryFetch(): typeof fetch {
  let calls = 0;
  return (async () => {
    calls += 1;
    const content = calls === 1 ? "{" : "still-not-json";
    return mockResponse({
      choices: [{ message: { content }, finish_reason: "stop" }],
      usage: { prompt_tokens: calls, completion_tokens: calls, total_tokens: calls * 2 },
    });
  }) as typeof fetch;
}

export const HOSTED_REQ_085_CASES: readonly HostedMockConformanceCase[] = [
  {
    id: "REQ-085:zai-local-schema-validation",
    requirement: "REQ-085",
    productId: "zai",
    fetch: successFetch("zai", { issues: [makeIssue()] }),
    expectedOutcome: "completed",
    expectedFindingsCount: 1,
  },
  {
    id: "REQ-085:zai-malformed-output-retry-limit",
    requirement: "REQ-085",
    productId: "zai",
    fetch: malformedRetryFetch(),
    expectedOutcome: "schema-failed",
    expectedAttemptCount: 2,
  },
  {
    id: "REQ-085:deepseek-required-usage",
    requirement: "REQ-085",
    productId: "deepseek",
    fetch: (async () =>
      mockResponse({
        choices: [{ message: { content: JSON.stringify({ issues: [] }) }, finish_reason: "stop" }],
      })) as typeof fetch,
    expectedOutcome: "transport-failed",
    expectedUsageAvailability: "required-missing",
  },
  {
    id: "REQ-085:deepseek-malformed-output-retry-limit",
    requirement: "REQ-085",
    productId: "deepseek",
    fetch: malformedRetryFetch(),
    expectedOutcome: "schema-failed",
    expectedAttemptCount: 2,
  },
  {
    id: "REQ-085:qwen-local-schema-validation",
    requirement: "REQ-085",
    productId: "qwen",
    evidencePatch: { region: "international" },
    workspaceAccountId: "ws-conformance-123",
    fetch: successFetch("qwen", { issues: [] }),
    expectedOutcome: "completed",
    expectedFindingsCount: 0,
  },
];

const MISTRAL_REGIONS = ["global", "eu"] as const;

type MistralBehaviour = Readonly<{
  behaviour: string;
  fetch: () => typeof fetch;
  expectedOutcome: HostedMockConformanceCase["expectedOutcome"];
  expectedAttemptCount: number;
  expectedFindingsCount?: number;
  prompt?: string;
}>;

const MISTRAL_BEHAVIOURS: readonly MistralBehaviour[] = [
  {
    behaviour: "long-diff",
    fetch: () => successFetch("mistral", { issues: [] }),
    expectedOutcome: "completed",
    expectedAttemptCount: 1,
    expectedFindingsCount: 0,
    prompt: LONG_DIFF_PROMPT,
  },
  {
    behaviour: "nullable-fields",
    fetch: () => successFetch("mistral", mistralNullableReview),
    expectedOutcome: "completed",
    expectedAttemptCount: 1,
    expectedFindingsCount: mistralNullableReview.issues.length,
  },
  {
    behaviour: "refusal",
    fetch: () =>
      (async () =>
        mockResponse({
          choices: [
            {
              message: { content: null, refusal: "I cannot review that diff." },
              finish_reason: "content_filter",
            },
          ],
        })) as typeof fetch,
    expectedOutcome: "schema-failed",
    expectedAttemptCount: 1,
  },
  {
    behaviour: "malformed-output",
    fetch: () =>
      (async () =>
        mockResponse({
          choices: [{ message: { content: "{" }, finish_reason: "stop" }],
        })) as typeof fetch,
    expectedOutcome: "schema-failed",
    expectedAttemptCount: 1,
  },
  {
    // Mistral's profile forbids the malformed-output retry, so a repeated
    // malformed body must still settle after exactly one attempt.
    behaviour: "bounded-retry",
    fetch: () => malformedRetryFetch(),
    expectedOutcome: "schema-failed",
    expectedAttemptCount: 1,
  },
];

/** Full Mistral endpoint x behaviour matrix: every behaviour is observed in both regions (REQ-086). */
export const HOSTED_REQ_086_CASES: readonly HostedMockConformanceCase[] = MISTRAL_REGIONS.flatMap(
  (region) =>
    MISTRAL_BEHAVIOURS.map((behaviour) => ({
      id: `REQ-086:mistral-${region}-${behaviour.behaviour}`,
      requirement: "REQ-086" as const,
      productId: "mistral" as const,
      evidencePatch: {
        normalizedEndpoint: defaultEndpoint("mistral", region),
        region,
        modelId: "mistral-small-2603",
      },
      ...(behaviour.prompt === undefined ? {} : { prompt: behaviour.prompt }),
      fetch: behaviour.fetch(),
      expectedOutcome: behaviour.expectedOutcome,
      expectedAttemptCount: behaviour.expectedAttemptCount,
      ...(behaviour.expectedFindingsCount === undefined
        ? {}
        : { expectedFindingsCount: behaviour.expectedFindingsCount }),
      expectedEndpoint: defaultEndpoint("mistral", region),
    })),
);

export const HOSTED_LIVE_PROBE_DESCRIPTORS: readonly HostedLiveProbeDescriptor[] =
  HOSTED_API_PRODUCT_IDS.map((productId) => {
    let region: string | null = null;
    if (productId === "mistral") region = "global";
    if (productId === "qwen") region = "international";

    return {
      productId,
      credentialEnv: resolveCredentialEnvironmentVariable(productId),
      modelId: suggestedModelId(productId),
      region,
      normalizedEndpoint:
        productId === "mistral" ? defaultEndpoint("mistral", "global") : defaultEndpoint(productId),
      workspaceAccountId: productId === "qwen" ? (process.env.QWEN_WORKSPACE_ID ?? null) : null,
      requiresEntitlement: productId === "qwen",
    };
  });

export async function runHostedLiveProbe(
  descriptor: HostedLiveProbeDescriptor,
): Promise<HostedConformanceObservation> {
  const skipReason = resolveHostedLiveSkipReason(descriptor);
  if (skipReason) {
    return reportHostedLiveSkipped(descriptor, skipReason);
  }

  const credential = process.env[descriptor.credentialEnv] as string;
  const fetch = globalThis.fetch;
  const evidenceKey = evidenceKeyFor(descriptor.productId, {
    modelId: descriptor.modelId,
    normalizedEndpoint: descriptor.normalizedEndpoint,
    region: descriptor.region ?? null,
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
      workspaceAccountId: descriptor.workspaceAccountId,
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
    usageAvailability: result.receipt.usageAvailability,
    findingsCount: result.result.issues.length,
    source: "live",
  };
}
