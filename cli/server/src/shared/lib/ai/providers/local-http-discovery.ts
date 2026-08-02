import { PRODUCT_REGISTRY } from "@diffgazer/core/providers";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  ExactModelIdSchema,
  LOCAL_OPENAI_PRESET_ENDPOINTS,
  type LocalHttpProductId,
} from "@diffgazer/core/schemas/config";
import {
  type RuntimeIdentity,
  sha256CanonicalJsonSync,
  type TerminalOutcome,
} from "@diffgazer/core/schemas/review";
import type { LocalReadinessObservationStatus } from "../../config/readiness.js";
import { buildReviewSchemaJson } from "./cli-compatibility-probe.js";
import {
  type LocalHttpAuth,
  type LocalHttpDependencies,
  type LocalHttpFetch,
  localHttpRequest,
  resolveLocalHttpDependencies,
  resolveLocalHttpEndpoint,
} from "./local-http-request.js";

/** Byte ceiling for discovery/conformance traffic, which carries no review payload. */
export const LOCAL_HTTP_DISCOVERY_MAX_RESPONSE_BYTES = 1_048_576;

/** Wall-time ceiling for one discovery/conformance round trip. */
export const LOCAL_HTTP_DISCOVERY_DEADLINE_MS = 30_000;

/** Minimal object contract used only to observe runtime conformance, never to review. */
const PROBE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["ok"] },
  },
  required: ["status"],
} as const;

const PROBE_PROMPT = 'Return exactly {"status":"ok"} as JSON with no surrounding text.';

/** The admitted review-result JSON schema every local generation must request. */
const REVIEW_RESULT_JSON_SCHEMA = buildReviewSchemaJson() as Record<string, unknown>;

export type DiscoveredLocalModel = Readonly<{
  modelId: string;
}>;

export type LocalHttpDiscoveryInput = Readonly<{
  productId: LocalHttpProductId;
  endpoint: string;
  auth: LocalHttpAuth;
  signal?: AbortSignal;
}>;

export type LocalHttpDiscoverySuccess = Readonly<{
  models: readonly DiscoveredLocalModel[];
  runtime: RuntimeIdentity;
}>;

export type LocalHttpDiscoveryFailureCode =
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

export function isSafeDiscoveredModelId(modelId: string): boolean {
  return ExactModelIdSchema.safeParse(modelId).success;
}

export function hashLocalConformanceIdentity(identity: LocalHttpConformanceIdentity): string {
  return sha256CanonicalJsonSync(identity);
}

export function getLocalHttpPrivacyNotice(productId: LocalHttpProductId): readonly string[] {
  return PRODUCT_REGISTRY[productId].notice.privacy;
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

function discoveryFailureFrom(
  failure: Readonly<{ code: string; safeMessage: string }>,
): LocalHttpDiscoveryFailure {
  if (failure.code === "endpoint-unreachable" || failure.code === "cancelled") {
    return { code: "endpoint-unreachable", safeMessage: failure.safeMessage };
  }
  return { code: "api-incompatible", safeMessage: failure.safeMessage };
}

async function requestJson(
  input: Readonly<{
    endpoint: string;
    pathname: string;
    auth: LocalHttpAuth;
    fetcher: LocalHttpFetch;
    signal?: AbortSignal;
  }>,
): Promise<Result<unknown, LocalHttpDiscoveryFailure>> {
  const response = await localHttpRequest({
    endpoint: input.endpoint,
    pathname: input.pathname,
    method: "GET",
    auth: input.auth,
    fetcher: input.fetcher,
    maxResponseBytes: LOCAL_HTTP_DISCOVERY_MAX_RESPONSE_BYTES,
    deadlineMs: LOCAL_HTTP_DISCOVERY_DEADLINE_MS,
    signal: input.signal,
  });
  if (!response.ok) {
    return err(discoveryFailureFrom(response.error));
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

async function discoverAtResolvedEndpoint(
  input: LocalHttpDiscoveryInput,
  fetcher: LocalHttpFetch,
): Promise<Result<LocalHttpDiscoverySuccess, LocalHttpDiscoveryFailure>> {
  if (input.productId === "ollama") {
    const version = await requestJson({
      endpoint: input.endpoint,
      pathname: "/api/version",
      auth: input.auth,
      fetcher,
      signal: input.signal,
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
      signal: input.signal,
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
    signal: input.signal,
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
  const resolvedDeps = resolveLocalHttpDependencies(dependencies);
  const resolved = await resolveLocalHttpEndpoint(input.endpoint, resolvedDeps);
  if (!resolved.ok) {
    return err({ code: "endpoint-forbidden", safeMessage: resolved.error.safeMessage });
  }

  return discoverAtResolvedEndpoint(
    { ...input, endpoint: resolved.value.endpoint },
    resolvedDeps.fetch,
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
  auth: LocalHttpAuth;
  fetcher: LocalHttpFetch;
  maxResponseBytes: number;
  deadlineMs?: number;
  /** Structured-output contract sent to the runtime; the probe contract is conformance-only. */
  schema: Record<string, unknown>;
  signal?: AbortSignal;
}>;

export type LocalGenerationFailure = Readonly<{
  code: Exclude<TerminalOutcome, "completed">;
  safeMessage: string;
}>;

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
        messages: [{ role: "user", content: input.prompt }],
        format: input.schema,
      },
    };
  }
  return {
    pathname: "/chat/completions",
    body: {
      model: input.modelId,
      stream: false,
      messages: [{ role: "user", content: input.prompt }],
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
    return err({ code: "transport-failed", safeMessage: response.error.safeMessage });
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
  const resolvedDeps = resolveLocalHttpDependencies(dependencies);
  const resolved = await resolveLocalHttpEndpoint(input.endpoint, resolvedDeps);
  if (!resolved.ok) {
    return err({ code: "endpoint-forbidden", safeMessage: resolved.error.safeMessage });
  }

  const endpoint = resolved.value.endpoint;
  const fetcher = resolvedDeps.fetch;
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

  if (!discovery.value.models.some((model) => model.modelId === input.modelId)) {
    return ok("selected-model-missing");
  }

  const probeRequest = {
    productId: input.productId,
    endpoint,
    modelId: input.modelId,
    prompt: PROBE_PROMPT,
    auth: input.auth,
    fetcher,
    maxResponseBytes: LOCAL_HTTP_DISCOVERY_MAX_RESPONSE_BYTES,
    deadlineMs: LOCAL_HTTP_DISCOVERY_DEADLINE_MS,
    schema: PROBE_SCHEMA as unknown as Record<string, unknown>,
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

  if (
    typeof generation.value !== "object" ||
    generation.value === null ||
    (generation.value as { status?: unknown }).status !== "ok"
  ) {
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
