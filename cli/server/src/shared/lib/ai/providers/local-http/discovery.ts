import { sha256CanonicalJsonSync } from "@diffgazer/core/json";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  ExactModelIdSchema,
  LOCAL_OPENAI_PRESET_ENDPOINTS,
  type LocalHttpProductId,
} from "@diffgazer/core/schemas/config";
import {
  buildProviderLensReviewResultJsonSchema,
  LensReviewResultSchema,
  type RuntimeIdentity,
  type TerminalOutcome,
} from "@diffgazer/core/schemas/review";
import type { LocalReadinessObservationStatus } from "../../../config/readiness.js";
import {
  type LocalHttpAuth,
  type LocalHttpDependencies,
  type LocalHttpFetch,
  type LocalHttpRequestFailure,
  localHttpRequest,
  resolveLocalHttpTransport,
} from "./request.js";
import type { AdmittedResponseByteBudget } from "./response-byte-budget.js";

/** Byte ceiling for discovery/conformance traffic, which carries no review payload. */
const LOCAL_HTTP_DISCOVERY_MAX_RESPONSE_BYTES = 1_048_576;

/** Wall-time ceiling for one discovery/conformance round trip. */
const LOCAL_HTTP_DISCOVERY_DEADLINE_MS = 30_000;

/** The wording the hosted conformance probe sends, so both attest the same ask. */
const PROBE_PROMPT = 'Return {"issues":[]} as JSON.';
/** A conforming answer is `{"issues":[]}`; anything longer is not conformance. */
const PROBE_MAX_OUTPUT_TOKENS = 256;

/** OpenAI-strict wire schema for local generation (`strict: true` on local-openai). */
const REVIEW_RESULT_JSON_SCHEMA = buildProviderLensReviewResultJsonSchema("openai-compatible");

export type DiscoveredLocalModel = Readonly<{
  modelId: string;
}>;

export type LocalHttpDiscoveryInput = Readonly<{
  productId: LocalHttpProductId;
  endpoint: string;
  auth: LocalHttpAuth;
  signal?: AbortSignal;
  /**
   * Remaining share of an admitted execution's wall time. Review dispatch passes
   * it so listing round trips are spent from the same budget generation uses;
   * standalone probes fall back to the fixed discovery deadline.
   */
  deadlineMs?: number;
  /** Remaining admitted response bytes for execution-time discovery traffic. */
  maxResponseBytes?: number;
  responseByteBudget?: AdmittedResponseByteBudget;
}>;

export type LocalHttpDiscoverySuccess = Readonly<{
  models: readonly DiscoveredLocalModel[];
  runtime: RuntimeIdentity;
}>;

type LocalHttpDiscoveryFailureCode =
  | "endpoint-forbidden"
  | "endpoint-unreachable"
  | "api-incompatible"
  | "no-review-capable-model";

export type LocalHttpDiscoveryFailure = Readonly<{
  code: LocalHttpDiscoveryFailureCode;
  safeMessage: string;
}>;

export type LocalHttpConformanceInput = Readonly<{
  productId: LocalHttpProductId;
  endpoint: string;
  modelId: string;
  auth: LocalHttpAuth;
  structuredOutputSchemaSha256: string;
  signal?: AbortSignal;
}>;

export type LocalHttpConformanceIdentity = Readonly<{
  productId: LocalHttpProductId;
  normalizedEndpoint: string;
  runtime: RuntimeIdentity;
  modelId: string;
}>;

export function isOllamaCloudModel(model: Readonly<Record<string, unknown>>): boolean {
  if (model.remote === true) return true;
  if (typeof model.remote_model === "string" && model.remote_model.length > 0) return true;
  const details = model.details;
  if (details && typeof details === "object" && (details as { remote?: boolean }).remote === true) {
    return true;
  }
  const name = typeof model.name === "string" ? model.name : "";
  return name.endsWith(":cloud") || name.includes("/cloud");
}

function isSafeDiscoveredModelId(modelId: string): boolean {
  return ExactModelIdSchema.safeParse(modelId).success;
}

export function hashLocalConformanceIdentity(identity: LocalHttpConformanceIdentity): string {
  return sha256CanonicalJsonSync(identity);
}

function parseRuntimeIdentity(
  productId: LocalHttpProductId,
  endpoint: string,
  version: string,
): RuntimeIdentity {
  if (productId === "ollama") {
    return { identity: "ollama", version };
  }
  if (endpoint === LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"]) {
    return { identity: "llama-cpp", version };
  }
  return { identity: "lm-studio", version };
}

function readLocalOpenAIServerVersion(payload: unknown, endpoint: string): string {
  if (payload && typeof payload === "object") {
    const version = (payload as { server_version?: unknown }).server_version;
    if (typeof version === "string" && version.length > 0) return version;
  }
  if (endpoint === LOCAL_OPENAI_PRESET_ENDPOINTS["lm-studio"]) return "lm-studio-local";
  if (endpoint === LOCAL_OPENAI_PRESET_ENDPOINTS["llama-cpp"]) return "llama-cpp-local";
  return "local-openai";
}

function mapOllamaModels(payload: unknown): readonly DiscoveredLocalModel[] {
  if (!payload || typeof payload !== "object") return [];
  const models = (payload as { models?: unknown }).models;
  if (!Array.isArray(models)) return [];

  const discovered: DiscoveredLocalModel[] = [];
  for (const entry of models) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (isOllamaCloudModel(record)) continue;
    const modelId = typeof record.name === "string" ? record.name : "";
    if (!isSafeDiscoveredModelId(modelId)) continue;
    discovered.push({ modelId });
  }
  return discovered;
}

function mapOpenAIModels(payload: unknown): readonly DiscoveredLocalModel[] {
  if (!payload || typeof payload !== "object") return [];
  const data = (payload as { data?: unknown }).data;
  if (!Array.isArray(data)) return [];

  const discovered: DiscoveredLocalModel[] = [];
  for (const entry of data) {
    if (!entry || typeof entry !== "object") continue;
    const modelId =
      typeof (entry as { id?: unknown }).id === "string" ? (entry as { id: string }).id : "";
    if (!isSafeDiscoveredModelId(modelId)) continue;
    discovered.push({ modelId });
  }
  return discovered;
}

/**
 * Projects the transport's failure union onto the four discovery codes. Typed on
 * the union rather than `string` so a new transport failure code fails the build
 * here instead of silently landing in `api-incompatible`.
 */
function discoveryFailureFrom(failure: LocalHttpRequestFailure): LocalHttpDiscoveryFailure {
  switch (failure.code) {
    case "endpoint-unreachable":
    case "cancelled":
    case "timed-out":
      return { code: "endpoint-unreachable", safeMessage: failure.safeMessage };
    case "redirect":
      return { code: "endpoint-forbidden", safeMessage: failure.safeMessage };
    case "oversize-response":
    case "api-incompatible":
      return { code: "api-incompatible", safeMessage: failure.safeMessage };
  }
}

async function requestJson(
  input: Readonly<{
    endpoint: string;
    pathname: string;
    auth: LocalHttpAuth;
    fetcher: LocalHttpFetch;
    signal?: AbortSignal;
    deadlineMs?: number;
    maxResponseBytes?: number;
    responseByteBudget?: AdmittedResponseByteBudget;
  }>,
): Promise<Result<unknown, LocalHttpDiscoveryFailure>> {
  const maxResponseBytes =
    input.responseByteBudget?.requestLimit() ??
    input.maxResponseBytes ??
    LOCAL_HTTP_DISCOVERY_MAX_RESPONSE_BYTES;
  const response = await localHttpRequest({
    endpoint: input.endpoint,
    pathname: input.pathname,
    method: "GET",
    auth: input.auth,
    fetcher: input.fetcher,
    maxResponseBytes,
    deadlineMs: input.deadlineMs ?? LOCAL_HTTP_DISCOVERY_DEADLINE_MS,
    signal: input.signal,
  });
  if (!response.ok) {
    return err(discoveryFailureFrom(response.error));
  }
  if (input.responseByteBudget) {
    const recorded = input.responseByteBudget.recordText(response.value);
    if (!recorded.ok) {
      return err({
        code: "api-incompatible",
        safeMessage: "Local HTTP response exceeded the admitted byte limit",
      });
    }
  }
  try {
    return ok(JSON.parse(response.value) as unknown);
  } catch {
    return err({
      code: "api-incompatible",
      safeMessage: "Local HTTP listing response was not JSON",
    });
  }
}

export async function discoverAtResolvedEndpoint(
  input: LocalHttpDiscoveryInput,
  fetcher: LocalHttpFetch,
): Promise<Result<LocalHttpDiscoverySuccess, LocalHttpDiscoveryFailure>> {
  const requestBudget = {
    signal: input.signal,
    deadlineMs: input.deadlineMs,
    maxResponseBytes: input.maxResponseBytes,
    responseByteBudget: input.responseByteBudget,
  } as const;

  if (input.productId === "ollama") {
    const version = await requestJson({
      endpoint: input.endpoint,
      pathname: "/api/version",
      auth: input.auth,
      fetcher,
      ...requestBudget,
    });
    if (!version.ok) return version;

    const versionValue = (version.value as { version?: unknown }).version;
    if (typeof versionValue !== "string" || versionValue.length === 0) {
      return err({ code: "api-incompatible", safeMessage: "Ollama version response was invalid" });
    }

    const tags = await requestJson({
      endpoint: input.endpoint,
      pathname: "/api/tags",
      auth: input.auth,
      fetcher,
      ...requestBudget,
    });
    if (!tags.ok) return tags;

    const models = mapOllamaModels(tags.value);
    if (models.length === 0) {
      return err({
        code: "no-review-capable-model",
        safeMessage: "No review-capable local model was listed",
      });
    }

    return ok({
      models,
      runtime: parseRuntimeIdentity("ollama", input.endpoint, versionValue),
    });
  }

  const listing = await requestJson({
    endpoint: input.endpoint,
    pathname: "/models",
    auth: input.auth,
    fetcher,
    ...requestBudget,
  });
  if (!listing.ok) return listing;

  const payload = listing.value;
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray((payload as { data?: unknown }).data)
  ) {
    return err({
      code: "api-incompatible",
      safeMessage: "Local OpenAI models response was invalid",
    });
  }

  const models = mapOpenAIModels(payload);
  if (models.length === 0) {
    return err({
      code: "no-review-capable-model",
      safeMessage: "No review-capable local model was listed",
    });
  }

  return ok({
    models,
    runtime: parseRuntimeIdentity(
      "local-openai",
      input.endpoint,
      readLocalOpenAIServerVersion(payload, input.endpoint),
    ),
  });
}

export async function discoverLocalHttpModels(
  input: LocalHttpDiscoveryInput,
  dependencies: LocalHttpDependencies = {},
): Promise<Result<LocalHttpDiscoverySuccess, LocalHttpDiscoveryFailure>> {
  const transport = await resolveLocalHttpTransport(input.endpoint, dependencies);
  if (!transport.ok) {
    return err({ code: "endpoint-forbidden", safeMessage: transport.error.safeMessage });
  }

  return discoverAtResolvedEndpoint(
    { ...input, endpoint: transport.value.endpoint },
    transport.value.fetcher,
  );
}

function extractJsonObject(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start === -1 || end <= start) return undefined;
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      return undefined;
    }
  }
}

function objectFromMessageContent(content: unknown): unknown {
  if (typeof content === "string") {
    return extractJsonObject(content);
  }
  if (content && typeof content === "object") {
    return content;
  }
  return undefined;
}

export type LocalGenerationInput = Readonly<{
  productId: LocalHttpProductId;
  endpoint: string;
  modelId: string;
  prompt: string;
  /** Trusted review instructions, sent on the runtime's own system message. */
  systemPrompt?: string;
  auth: LocalHttpAuth;
  fetcher: LocalHttpFetch;
  maxResponseBytes: number;
  /** Admitted output-token ceiling, sent as the runtime's own hard stop. */
  maxOutputTokens: number;
  deadlineMs?: number;
  /** Structured-output contract sent to the runtime; the probe contract is conformance-only. */
  schema: Record<string, unknown>;
  signal?: AbortSignal;
  responseByteBudget?: AdmittedResponseByteBudget;
}>;

export type LocalGenerationFailure = Readonly<{
  code: Exclude<TerminalOutcome, "completed">;
  safeMessage: string;
}>;

function generationMessages(input: LocalGenerationInput): Array<Record<string, string>> {
  return input.systemPrompt
    ? [
        { role: "system", content: input.systemPrompt },
        { role: "user", content: input.prompt },
      ]
    : [{ role: "user", content: input.prompt }];
}

function generationBody(input: LocalGenerationInput): Readonly<{
  pathname: string;
  body: Record<string, unknown>;
}> {
  if (input.productId === "ollama") {
    return {
      pathname: "/api/chat",
      body: {
        model: input.modelId,
        stream: false,
        messages: generationMessages(input),
        format: input.schema,
        // Ollama's hard output stop. Without it the runtime uses its own default,
        // so the admitted maxOutputTokens would be advisory only.
        options: { num_predict: input.maxOutputTokens },
      },
    };
  }
  return {
    pathname: "/chat/completions",
    body: {
      model: input.modelId,
      stream: false,
      messages: generationMessages(input),
      max_tokens: input.maxOutputTokens,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "review_result",
          strict: true,
          schema: input.schema,
        },
      },
    },
  };
}

function extractGeneratedObject(productId: LocalHttpProductId, payload: unknown): unknown {
  if (productId === "ollama") {
    return objectFromMessageContent(
      (payload as { message?: { content?: unknown } }).message?.content,
    );
  }
  const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> }).choices?.[0]
    ?.message?.content;
  return objectFromMessageContent(content);
}

/** One bounded local generation call returning the runtime's structured object. */
export async function generateLocalHttpObject(
  input: LocalGenerationInput,
): Promise<Result<unknown, LocalGenerationFailure>> {
  const request = generationBody(input);
  const response = await localHttpRequest({
    endpoint: input.endpoint,
    pathname: request.pathname,
    method: "POST",
    auth: input.auth,
    body: request.body,
    fetcher: input.fetcher,
    maxResponseBytes: input.maxResponseBytes,
    deadlineMs: input.deadlineMs,
    signal: input.signal,
  });

  if (!response.ok) {
    if (response.error.code === "cancelled") {
      return err({ code: "cancelled", safeMessage: response.error.safeMessage });
    }
    if (response.error.code === "timed-out") {
      return err({ code: "timed-out", safeMessage: response.error.safeMessage });
    }
    if (response.error.code === "oversize-response") {
      return err({
        code: "transport-failed",
        safeMessage: "Local HTTP response exceeded the admitted byte limit",
      });
    }
    return err({ code: "transport-failed", safeMessage: response.error.safeMessage });
  }

  if (input.responseByteBudget) {
    const recorded = input.responseByteBudget.recordText(response.value);
    if (!recorded.ok) {
      return err({
        code: "transport-failed",
        safeMessage: "Local HTTP response exceeded the admitted byte limit",
      });
    }
  }

  let payload: unknown;
  try {
    payload = JSON.parse(response.value);
  } catch {
    return err({ code: "schema-failed", safeMessage: "Local HTTP response was not JSON" });
  }

  const object = extractGeneratedObject(input.productId, payload);
  if (object === undefined) {
    return err({ code: "schema-failed", safeMessage: "Local HTTP response did not contain JSON" });
  }
  return ok(object);
}

/** Review-result schema the adapter sends for real generation (REQ-033). */
export function reviewResultJsonSchema(): Record<string, unknown> {
  return REVIEW_RESULT_JSON_SCHEMA;
}

export async function probeLocalHttpConformance(
  input: LocalHttpConformanceInput,
  dependencies: LocalHttpDependencies = {},
): Promise<Result<LocalReadinessObservationStatus, LocalHttpDiscoveryFailure>> {
  const transport = await resolveLocalHttpTransport(input.endpoint, dependencies);
  if (!transport.ok) {
    return err({ code: "endpoint-forbidden", safeMessage: transport.error.safeMessage });
  }

  const endpoint = transport.value.endpoint;
  const fetcher = transport.value.fetcher;
  const discovery = await discoverAtResolvedEndpoint(
    {
      productId: input.productId,
      endpoint,
      auth: input.auth,
      signal: input.signal,
    },
    fetcher,
  );
  if (!discovery.ok) return discovery;

  const selectedModel = mapSelectedModelMissing(input.modelId, discovery.value.models);
  if (selectedModel !== "passed") {
    return ok(selectedModel);
  }

  const probeRequest = {
    productId: input.productId,
    endpoint,
    modelId: input.modelId,
    prompt: PROBE_PROMPT,
    auth: input.auth,
    fetcher,
    maxResponseBytes: LOCAL_HTTP_DISCOVERY_MAX_RESPONSE_BYTES,
    maxOutputTokens: PROBE_MAX_OUTPUT_TOKENS,
    deadlineMs: LOCAL_HTTP_DISCOVERY_DEADLINE_MS,
    schema: REVIEW_RESULT_JSON_SCHEMA,
  } as const;

  const generation = await generateLocalHttpObject({ ...probeRequest, signal: input.signal });
  if (!generation.ok) {
    if (generation.error.code === "cancelled") {
      return ok("cancellation-failed");
    }
    if (generation.error.code === "schema-failed") {
      return ok("conformance-failed");
    }
    return ok("endpoint-unreachable");
  }

  if (!LensReviewResultSchema.safeParse(generation.value).success) {
    return ok("conformance-failed");
  }

  const abort = new AbortController();
  abort.abort();
  const abortProbe = await generateLocalHttpObject({ ...probeRequest, signal: abort.signal });
  if (abortProbe.ok || abortProbe.error.code !== "cancelled") {
    return ok("cancellation-failed");
  }

  return ok("passed");
}

export function mapDiscoveryFailureToObservation(
  failure: LocalHttpDiscoveryFailure,
): Exclude<
  LocalReadinessObservationStatus,
  "passed" | "conformance-failed" | "cancellation-failed"
> {
  switch (failure.code) {
    case "endpoint-forbidden":
      return "endpoint-forbidden";
    case "endpoint-unreachable":
      return "endpoint-unreachable";
    case "api-incompatible":
      return "api-incompatible";
    case "no-review-capable-model":
      return "no-review-capable-model";
  }
}

export function mapSelectedModelMissing(
  modelId: string,
  models: readonly DiscoveredLocalModel[],
): LocalReadinessObservationStatus {
  return models.some((model) => model.modelId === modelId) ? "passed" : "selected-model-missing";
}
