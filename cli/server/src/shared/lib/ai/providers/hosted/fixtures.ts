import { CREDENTIAL_ENV_VARS, PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { HOSTED_API_PRODUCT_IDS, type HostedApiProductId } from "@diffgazer/core/schemas/config";
import type { EvidenceKey, TerminalOutcome } from "@diffgazer/core/schemas/review";
import { makeIssue } from "@diffgazer/core/testing/factories";
import { z } from "zod";
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
  | "model-unresolved";

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

export type HostedLiveProbeDescriptor = Readonly<{
  productId: HostedApiProductId;
  credentialEnv: string;
  /** Null when the product suggests no model; the live probe discovers one instead. */
  modelId: string | null;
  normalizedEndpoint?: string;
}>;

/** Stand-in model id for mock cases, whose requests never leave the process. */
const MOCK_MODEL_ID = "model-1";
const SCHEMA_SHA256 = "1".repeat(64);
const CREDENTIAL_REFERENCE_IDENTITY = "3".repeat(64);
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
function suggestedModelId(productId: HostedApiProductId): string | null {
  const policy = PRODUCT_REGISTRY[productId].modelPolicy;
  if ("suggestedModelId" in policy && policy.suggestedModelId) {
    return policy.suggestedModelId;
  }
  // OpenRouter pins downstream provider/model routes instead of suggesting one.
  if (productId === "openrouter") return "openai/gpt-4.1-mini";
  return null;
}

function defaultEndpoint(productId: HostedApiProductId): string {
  return (
    PRODUCT_REGISTRY[productId].configuration.endpoints[0]?.endpoint ?? "https://example.invalid/v1"
  );
}

function evidenceKeyFor(
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

function mockResponse(body: unknown, init: { status?: number } = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json" },
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
    context: hostedContext(observingFetch),
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
    fetch: (async () => mockResponse({ error: "rate limited" }, { status: 429 })) as typeof fetch,
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
  const response = await globalThis
    .fetch(`${endpoint}/models`, { headers: { authorization: `Bearer ${credential}` } })
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

  const credential = process.env[descriptor.credentialEnv] as string;
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
    usageAvailability: result.receipt.usageAvailability,
    findingsCount: result.result.issues.length,
    source: "live",
  };
}
