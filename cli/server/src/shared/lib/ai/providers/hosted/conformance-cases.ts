/**
 * The offline hosted conformance matrix: the observation shapes every case
 * reports, the harness that drives one mock case through the production
 * adapter, and the REQ-084/085/086 case tables. Every request here is stubbed;
 * the network-bearing probes live in `live-probe.ts`.
 */
import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import type { HostedApiProductId } from "@diffgazer/core/schemas/config";
import type { EvidenceKey, TerminalOutcome } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import {
  DEFAULT_HOSTED_REVIEW_SCHEMA,
  executeHostedReview,
  type HostedExecutionContext,
} from "./transport.js";

type HostedConformanceRequirement = "REQ-084" | "REQ-085" | "REQ-086";

export type HostedConformanceSkipReason =
  | "live-probes-disabled"
  | "credential-missing"
  | "model-unresolved";

/** What a mock case actually observed; the pass/fail verdict belongs to the test. */
export type HostedMockObservation = Readonly<{
  requirement: HostedConformanceRequirement;
  caseId: string;
  productId: HostedApiProductId;
  outcome: TerminalOutcome;
  attemptCount: number;
  findingsCount: number;
  /** Endpoint origin the adapter actually requested, observed from the injected fetch. */
  requestedEndpoint: string | undefined;
  source: "mock";
}>;

export type HostedConformanceObservation = Readonly<{
  status: "passed" | "failed" | "skipped";
  requirement: HostedConformanceRequirement;
  caseId: string;
  productId: HostedApiProductId;
  outcome?: TerminalOutcome;
  attemptCount?: number;
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
  aborted?: boolean;
  limitsPatch?: Partial<EvidenceKey["limits"]>;
  fetch: typeof fetch;
  expectedOutcome: TerminalOutcome;
  expectedAttemptCount?: number;
  /** Findings the completed case must return; a non-completed outcome must return none. */
  expectedFindingsCount?: number;
  /** Endpoint the case requires the adapter to call; asserts product routing. */
  expectedEndpoint?: string;
}>;

/** Stand-in model id for mock cases, whose requests never leave the process. */
const MOCK_MODEL_ID = "model-1";
const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
const TEST_CREDENTIAL = "hosted-conformance-synthetic-credential";

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

const DEFAULT_LIMITS = {
  maxInputTokens: 20_000,
  maxResponseBytes: 1_048_576,
  wallTimeMs: 120_000,
  maxRetries: 2,
  maxConcurrency: 1,
  maxCostUsd: 0.5,
} as const;

const LONG_DIFF_PROMPT = `Review this diff:\n${"@@ -1,1 +1,1 @@\n-old\n+new\n".repeat(400)}`;

/**
 * The product's suggested model id, or null when it publishes none: a
 * `discovered-exact` product rotates its routes, so its ids come from discovery
 * and a pinned guess would name a dead route.
 */
export function suggestedModelId(productId: HostedApiProductId): string | null {
  const policy = PRODUCT_REGISTRY[productId].modelPolicy;
  if ("suggestedModelId" in policy && policy.suggestedModelId) {
    return policy.suggestedModelId;
  }
  // OpenRouter pins downstream provider/model routes instead of suggesting one.
  if (productId === "openrouter") return "openai/gpt-4.1-mini";
  return null;
}

export function defaultEndpoint(productId: HostedApiProductId): string {
  return (
    PRODUCT_REGISTRY[productId].configuration.endpoints[0]?.endpoint ?? "https://example.invalid/v1"
  );
}

export function evidenceKeyFor(
  productId: HostedApiProductId,
  patch: Partial<Extract<EvidenceKey, { transportFamily: "hosted-api" }>> = {},
): EvidenceKey {
  const product = PRODUCT_REGISTRY[productId];

  return {
    authentication: null,
    credentialReferenceIdentity: CREDENTIAL_REFERENCE_IDENTITY,
    installationId: null,
    productId,
    transportFamily: "hosted-api",
    normalizedEndpoint: defaultEndpoint(productId),
    region: null,
    workspaceAccountReference: null,
    modelId: suggestedModelId(productId) ?? MOCK_MODEL_ID,
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
  init: { status?: number; headers?: Record<string, string> } = {},
): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function successFetch(productId: HostedApiProductId, content: unknown): typeof fetch {
  const body = productId === "gemini" ? googleBody(content) : openAiBody(content);
  return (async () => mockResponse(body)) as typeof fetch;
}

function hostedContext(fetchFn: typeof fetch): HostedExecutionContext {
  return {
    credential: TEST_CREDENTIAL,
    reviewSchema: DEFAULT_HOSTED_REVIEW_SCHEMA,
    structuredOutputSchema: STRUCTURED_OUTPUT_SCHEMA,
    fetch: fetchFn,
  };
}

export function canProduceReadyEvidence(
  observation: HostedConformanceObservation | HostedMockObservation,
): boolean {
  if (observation.source === "mock") return false;
  return observation.status === "passed" && observation.outcome === "completed";
}

export async function runHostedMockConformanceCase(
  testCase: HostedMockConformanceCase,
): Promise<HostedMockObservation> {
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
    context: hostedContext(observingFetch),
  });

  return {
    requirement: testCase.requirement,
    caseId: testCase.id,
    productId: testCase.productId,
    outcome: result.receipt.outcome,
    attemptCount: result.receipt.attemptCount,
    findingsCount: result.result.issues.length,
    requestedEndpoint,
    source: "mock",
  };
}

const nullableFieldsReview = {
  issues: [
    {
      id: "nullable-fields-1",
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
    productId: "openrouter",
    fetch: (async () =>
      mockResponse({ error: "invalid_api_key" }, { status: 401 })) as typeof fetch,
    expectedOutcome: "transport-failed",
  },
  {
    id: "REQ-084:missing-model",
    requirement: "REQ-084",
    productId: "openrouter",
    fetch: (async () =>
      mockResponse({ error: "model_not_found" }, { status: 404 })) as typeof fetch,
    expectedOutcome: "transport-failed",
  },
  {
    id: "REQ-084:rate-limit",
    requirement: "REQ-084",
    productId: "openrouter",
    // `retry-after: 0` keeps the persistent rate limit real — the adapter still
    // spends its whole 429 retry budget before terminating — without paying the
    // default backoff's real-time sleeps in the offline matrix.
    fetch: (async () =>
      mockResponse(
        { error: "rate limited" },
        { status: 429, headers: { "retry-after": "0" } },
      )) as typeof fetch,
    expectedOutcome: "transport-failed",
  },
  {
    id: "REQ-084:malformed-response",
    requirement: "REQ-084",
    productId: "openrouter",
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
    productId: "openrouter",
    fetch: (async () => {
      throw new TypeError("redirect mode is error");
    }) as typeof fetch,
    expectedOutcome: "transport-failed",
  },
  {
    id: "REQ-084:oversized-response",
    requirement: "REQ-084",
    productId: "openrouter",
    limitsPatch: { maxResponseBytes: 256 },
    fetch: (async () =>
      mockResponse(openAiBody({ issues: [], filler: "x".repeat(2_048) }))) as typeof fetch,
    expectedOutcome: "transport-failed",
  },
  {
    id: "REQ-084:cancellation",
    requirement: "REQ-084",
    productId: "openrouter",
    aborted: true,
    fetch: successFetch("openrouter", { issues: [] }),
    expectedOutcome: "cancelled",
  },
  {
    id: "REQ-084:provider-failure",
    requirement: "REQ-084",
    productId: "openrouter",
    fetch: (async () =>
      mockResponse({ error: "upstream unavailable" }, { status: 503 })) as typeof fetch,
    expectedOutcome: "transport-failed",
  },
  {
    id: "REQ-084:valid-http-json-without-review-schema",
    requirement: "REQ-084",
    productId: "openrouter",
    fetch: (async () => mockResponse({ ok: true, data: { status: "healthy" } })) as typeof fetch,
    expectedOutcome: "transport-failed",
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
    id: "REQ-085:opencode-zen-local-schema-validation",
    requirement: "REQ-085",
    productId: "opencode-zen",
    fetch: successFetch("opencode-zen", { issues: [makeIssue()] }),
    expectedOutcome: "completed",
    expectedFindingsCount: 1,
  },
  {
    id: "REQ-085:opencode-zen-malformed-output-retry-limit",
    requirement: "REQ-085",
    productId: "opencode-zen",
    fetch: malformedRetryFetch(),
    expectedOutcome: "schema-failed",
    expectedAttemptCount: 2,
  },
  {
    // Strict json-schema over the openai-compatible wire: a combination no other
    // offline case covers (gemini is strict/google, openrouter strict/openrouter).
    id: "REQ-085:moonshot-strict-schema",
    requirement: "REQ-085",
    productId: "moonshot",
    fetch: successFetch("moonshot", { issues: [makeIssue()] }),
    expectedOutcome: "completed",
    expectedFindingsCount: 1,
    expectedEndpoint: defaultEndpoint("moonshot"),
  },
  {
    id: "REQ-085:ollama-cloud-local-schema-validation",
    requirement: "REQ-085",
    productId: "ollama-cloud",
    fetch: successFetch("ollama-cloud", { issues: [] }),
    expectedOutcome: "completed",
    expectedFindingsCount: 0,
  },
];

type DepthBehaviour = Readonly<{
  behaviour: string;
  fetch: () => typeof fetch;
  expectedOutcome: HostedMockConformanceCase["expectedOutcome"];
  expectedAttemptCount: number;
  expectedFindingsCount?: number;
  prompt?: string;
}>;

const DEPTH_BEHAVIOURS: readonly DepthBehaviour[] = [
  {
    behaviour: "long-diff",
    fetch: () => successFetch("openrouter", { issues: [] }),
    expectedOutcome: "completed",
    expectedAttemptCount: 1,
    expectedFindingsCount: 0,
    prompt: LONG_DIFF_PROMPT,
  },
  {
    behaviour: "nullable-fields",
    fetch: () => successFetch("openrouter", nullableFieldsReview),
    expectedOutcome: "completed",
    expectedAttemptCount: 1,
    expectedFindingsCount: nullableFieldsReview.issues.length,
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
    expectedOutcome: "transport-failed",
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
    // OpenRouter routes without structured_outputs degrade to JSON mode with
    // local validation, so the profile allows one malformed-output retry: a
    // repeated malformed body settles after exactly two attempts, never more.
    behaviour: "bounded-retry",
    fetch: () => malformedRetryFetch(),
    expectedOutcome: "schema-failed",
    expectedAttemptCount: 2,
  },
];

/** Depth matrix for a strict-schema hosted product with a bounded retry (REQ-086). */
export const HOSTED_REQ_086_CASES: readonly HostedMockConformanceCase[] = DEPTH_BEHAVIOURS.map(
  (behaviour) => ({
    id: `REQ-086:openrouter-${behaviour.behaviour}`,
    requirement: "REQ-086" as const,
    productId: "openrouter" as const,
    ...(behaviour.prompt === undefined ? {} : { prompt: behaviour.prompt }),
    fetch: behaviour.fetch(),
    expectedOutcome: behaviour.expectedOutcome,
    expectedAttemptCount: behaviour.expectedAttemptCount,
    ...(behaviour.expectedFindingsCount === undefined
      ? {}
      : { expectedFindingsCount: behaviour.expectedFindingsCount }),
    expectedEndpoint: defaultEndpoint("openrouter"),
  }),
);
