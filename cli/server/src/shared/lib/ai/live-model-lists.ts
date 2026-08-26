import * as path from "node:path";
import { CatalogModelNameSchema } from "@diffgazer/core/catalog";
import { getErrorMessage } from "@diffgazer/core/errors";
import { err, ok, type Result } from "@diffgazer/core/result";
import {
  type ConfigurationId,
  ExactModelIdSchema,
  type RunnableProductId,
} from "@diffgazer/core/schemas/config";
import { z } from "zod";
import { findSecretBinding } from "../config/persistence/secrets.js";
import { resolveSecretBinding } from "../config/secret-bindings.js";
import { secretIO } from "../config/secret-io.js";
import { getStore } from "../config/store.js";
import { log } from "../log.js";
import { getGlobalDiffgazerDir } from "../paths.js";
import { isEntryFresh, loadDiskCache, persistDiskCache } from "./disk-cache.js";
import { readJsonResponseWithLimit } from "./http-json.js";
import { HOSTED_PROFILES } from "./providers/hosted/profiles.js";

const LIVE_LIST_TTL_MS = 5 * 60 * 1000;

/** Public model lists that answer without a credential, so the request carries none. */
const PUBLIC_MODEL_LIST_URLS: Partial<Record<RunnableProductId, string>> = {
  openrouter: "https://openrouter.ai/api/v1/models",
  "ollama-cloud": "https://ollama.com/v1/models",
};

/**
 * Hosted products whose OpenAI-compatible wire exposes `GET {endpoint}/models`
 * behind the configuration's own key. Gemini's chat wire is google-native, but
 * its endpoint mounts an OpenAI-compat layer whose list route it joins through
 * the exceptions below.
 */
const CONFIGURATION_MODEL_LIST_PRODUCTS = new Set<string>([
  ...Object.entries(HOSTED_PROFILES)
    .filter(
      ([productId, profile]) =>
        profile.wireFamily === "openai-compatible" && !(productId in PUBLIC_MODEL_LIST_URLS),
    )
    .map(([productId]) => productId),
  "gemini",
]);

/**
 * Gemini's key-bearing list lives on the OpenAI-compat layer mounted under its
 * `/v1beta` endpoint, and its ids come back `models/`-prefixed — a shape the
 * catalog merge would never match and the google dispatch URL would double —
 * so the prefix is stripped on ingest.
 */
const GEMINI_MODEL_LIST_PATH = "/openai/models";

const stripGeminiModelsPrefix = (raw: unknown): unknown => {
  if (typeof raw !== "object" || raw === null) return raw;
  const { id } = raw as { id?: unknown };
  return typeof id === "string" && id.startsWith("models/")
    ? { ...raw, id: id.slice("models/".length) }
    : raw;
};

const LiveModelSchema = z.object({
  id: ExactModelIdSchema,
  name: CatalogModelNameSchema.optional(),
  tier: z.enum(["free", "paid", "unknown"]),
  contextTokens: z.number().int().positive().optional(),
  structuredOutput: z.boolean().optional(),
  reasoning: z.boolean().optional(),
});
export type LiveModel = z.infer<typeof LiveModelSchema>;

/**
 * Bumped when `LiveModel` gains capability fields: the picker path treats an
 * older-shape cache as expired so a binary upgrade cannot silently disarm
 * capability gates until the TTL happens to lapse. The dispatch-time read
 * stays shape-blind — it never fetches, and stale evidence beats guessing.
 */
export const LIVE_LIST_SHAPE_VERSION = 2;

const LiveModelListEntrySchema = z.object({
  models: z.array(LiveModelSchema),
  fetchedAt: z.iso.datetime(),
  shapeVersion: z.number().int().optional(),
});
type LiveModelListEntry = z.infer<typeof LiveModelListEntrySchema>;

export interface LiveModelList extends LiveModelListEntry {
  readonly cached: boolean;
}

// The id is the only field a list must carry; metadata is best-effort so an
// upstream shape change in pricing or names cannot drop the model itself.
const UpstreamModelSchema = z.object({
  id: ExactModelIdSchema,
  name: CatalogModelNameSchema.optional().catch(undefined),
  pricing: z
    .object({ prompt: z.string().optional(), completion: z.string().optional() })
    .optional()
    .catch(undefined),
  context_length: z.number().int().positive().optional().catch(undefined),
  supported_parameters: z.array(z.string()).optional().catch(undefined),
});
const UpstreamModelListSchema = z.object({ data: z.array(z.unknown()) });

const tierFromPricing = (
  pricing: z.infer<typeof UpstreamModelSchema>["pricing"],
): LiveModel["tier"] => {
  if (pricing?.prompt === undefined || pricing.completion === undefined) return "unknown";
  return pricing.prompt === "0" && pricing.completion === "0" ? "free" : "paid";
};

const toLiveModel = (raw: unknown): LiveModel | null => {
  const parsed = UpstreamModelSchema.safeParse(raw);
  if (!parsed.success) return null;
  const { id, name, pricing, context_length, supported_parameters } = parsed.data;
  return {
    id,
    ...(name === undefined ? {} : { name }),
    tier: tierFromPricing(pricing),
    ...(context_length === undefined ? {} : { contextTokens: context_length }),
    ...(supported_parameters === undefined
      ? {}
      : {
          structuredOutput: supported_parameters.includes("structured_outputs"),
          reasoning: supported_parameters.includes("reasoning"),
        }),
  };
};

const fetchModelList = async (
  url: string,
  headers: Record<string, string>,
  normalizeModel?: (raw: unknown) => unknown,
): Promise<Result<LiveModel[], { message: string }>> => {
  let response: Response;
  try {
    // redirect: "error" pins the request to the URL it was built for; a
    // credential must never follow a 3xx to another host.
    response = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(10_000),
      redirect: "error",
    });
  } catch (error) {
    return err({ message: getErrorMessage(error, "Model list request failed") });
  }
  if (!response.ok) return err({ message: `Model list request failed: ${response.status}` });

  const payload = await readJsonResponseWithLimit(response, "Model list");
  if (!payload.ok) return payload;
  const parsed = UpstreamModelListSchema.safeParse(payload.value);
  if (!parsed.success) return err({ message: "Model list response is not a model list" });

  const models = parsed.data.data.flatMap((raw) => {
    const model = toLiveModel(normalizeModel ? normalizeModel(raw) : raw);
    return model ? [model] : [];
  });
  if (models.length === 0) return err({ message: "Model list response carried no usable models" });
  return ok(models);
};

/** In-memory mirror of the on-disk list files, keyed by their path. */
const memory = new Map<string, LiveModelListEntry>();

const cachePathFor = (key: string): string =>
  path.join(getGlobalDiffgazerDir(), "model-lists", `${key}.json`);

const readFreshModelList = (key: string): LiveModelList | null => {
  const cachePath = cachePathFor(key);
  const cached = memory.get(cachePath) ?? loadDiskCache(cachePath, LiveModelListEntrySchema);
  return cached &&
    cached.shapeVersion === LIVE_LIST_SHAPE_VERSION &&
    isEntryFresh(cached, LIVE_LIST_TTL_MS)
    ? { ...cached, cached: true }
    : null;
};

const readStoredModelList = (key: string): LiveModelList | null => {
  const cachePath = cachePathFor(key);
  const cached = memory.get(cachePath) ?? loadDiskCache(cachePath, LiveModelListEntrySchema);
  return cached ? { ...cached, cached: true } : null;
};

const fetchAndStoreModelList = async (
  key: string,
  url: string,
  headers: Record<string, string>,
  normalizeModel?: (raw: unknown) => unknown,
): Promise<LiveModelList | null> => {
  const cachePath = cachePathFor(key);
  const fetched = await fetchModelList(url, headers, normalizeModel);
  if (!fetched.ok) {
    log("info", "live_model_list_unavailable", { url, error: fetched.error.message });
    return null;
  }
  const entry: LiveModelListEntry = {
    models: fetched.value,
    fetchedAt: new Date().toISOString(),
    shapeVersion: LIVE_LIST_SHAPE_VERSION,
  };
  memory.set(cachePath, entry);
  try {
    persistDiskCache(cachePath, entry);
  } catch (error) {
    log("warn", "live_model_list_persist_failed", { error: getErrorMessage(error) });
  }
  return { ...entry, cached: false };
};

interface ConfigurationAccess {
  readonly endpoint: string;
  readonly credential: string;
}

/** The configuration's own endpoint and credential — the only pair a key-bearing list request may use. */
const resolveConfigurationAccess = async (
  configurationId: ConfigurationId,
): Promise<ConfigurationAccess | null> => {
  const current = await getStore().readCurrentState();
  if (!current.ok) return null;
  const configuration = current.value.config.configurations.find(
    (candidate) =>
      candidate.status === "supported" && candidate.record.configurationId === configurationId,
  );
  if (configuration?.status !== "supported") return null;
  const { record } = configuration;
  if (record.input.transportFamily !== "hosted-api") return null;
  const binding = findSecretBinding(current.value.secrets, record.configurationId, record.revision);
  if (!binding) return null;
  const credential = await resolveSecretBinding(binding, secretIO, {
    configurationId: record.configurationId,
    revision: record.revision,
  });
  if (credential === null) return null;
  return { endpoint: record.input.endpoint, credential };
};

/**
 * The already-cached live list only, never a fetch: dispatch-time capability
 * checks read what the model picker's own list request left behind, and a cold
 * cache honestly returns null rather than adding a network round trip to every
 * dispatch. Age is deliberately ignored: the TTL paces refetching in
 * `resolveLiveModelList`, but a route's declared capabilities do not decay in
 * five minutes, and a strict-capable model must not silently degrade because
 * the picker was last opened before the TTL ran out — stale capability
 * evidence still beats guessing.
 */
export const readCachedLiveModelList = (tuple: {
  readonly configurationId: ConfigurationId;
  readonly productId: RunnableProductId;
}): LiveModelList | null => {
  if (tuple.productId in PUBLIC_MODEL_LIST_URLS) return readStoredModelList(tuple.productId);
  if (!CONFIGURATION_MODEL_LIST_PRODUCTS.has(tuple.productId)) return null;
  return readStoredModelList(`configuration-${tuple.configurationId}`);
};

/**
 * The product's own current model list, or null when the product has none,
 * the configuration has no usable credential, or the request failed — the
 * caller then serves models.dev alone. Public lists are keyed by product; a
 * key-bearing list is keyed by the configuration whose credential fetched it.
 */
export const resolveLiveModelList = async (tuple: {
  readonly configurationId: ConfigurationId;
  readonly productId: RunnableProductId;
}): Promise<LiveModelList | null> => {
  const publicUrl = PUBLIC_MODEL_LIST_URLS[tuple.productId];
  if (publicUrl) {
    return (
      readFreshModelList(tuple.productId) ?? fetchAndStoreModelList(tuple.productId, publicUrl, {})
    );
  }
  if (!CONFIGURATION_MODEL_LIST_PRODUCTS.has(tuple.productId)) return null;

  // A fresh cached list needs no credential, so the secret is read only when a fetch is due.
  const key = `configuration-${tuple.configurationId}`;
  const cached = readFreshModelList(key);
  if (cached) return cached;

  const access = await resolveConfigurationAccess(tuple.configurationId).catch((error) => {
    log("info", "live_model_list_credential_unavailable", {
      configurationId: tuple.configurationId,
      error: getErrorMessage(error),
    });
    return null;
  });
  if (!access) return null;
  const gemini = tuple.productId === "gemini";
  return fetchAndStoreModelList(
    key,
    `${access.endpoint}${gemini ? GEMINI_MODEL_LIST_PATH : "/models"}`,
    { authorization: `Bearer ${access.credential}` },
    gemini ? stripGeminiModelsPrefix : undefined,
  );
};
