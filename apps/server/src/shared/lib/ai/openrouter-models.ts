import { getErrorMessage } from "@diffgazer/core/errors";
import { type Result, ok, err } from "@diffgazer/core/result";
import {
  OpenRouterModelCacheSchema,
  OpenRouterModelSchema,
  type OpenRouterModel,
  type OpenRouterModelCache,
} from "@diffgazer/schemas/config";
import { getGlobalOpenRouterModelsPath } from "../paths.js";
import { readJsonFileSync, writeJsonFileSync } from "../fs.js";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

const parseCost = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value !== "string") return 0;
  const match = value.match(/-?\d+(\.\d+)?/);
  const parsed = match ? Number.parseFloat(match[0]) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapOpenRouterModel = (raw: unknown): OpenRouterModel | null => {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = typeof r.id === "string" ? r.id : "";
  if (!id) return null;

  const name = typeof r.name === "string" ? r.name : id;
  const description = typeof r.description === "string" ? r.description : undefined;

  const topProvider = r.top_provider && typeof r.top_provider === "object"
    ? (r.top_provider as Record<string, unknown>)
    : null;
  const contextLengthRaw =
    r.context_length ??
    r.context_window ??
    r.contextLength ??
    r.contextWindow ??
    topProvider?.context_length ??
    topProvider?.contextLength;
  const contextLength = Number.isFinite(Number(contextLengthRaw))
    ? Number(contextLengthRaw)
    : 0;

  const supportedParametersRaw = Array.isArray(r.supported_parameters)
    ? r.supported_parameters
    : Array.isArray(r.supportedParameters)
      ? r.supportedParameters
      : undefined;

  const pricingRaw = (r.pricing && typeof r.pricing === "object" ? r.pricing : {}) as Record<string, unknown>;
  const prompt = pricingRaw.prompt ?? "0";
  const completion = pricingRaw.completion ?? "0";

  const totalCost = parseCost(prompt) + parseCost(completion) + parseCost(pricingRaw.request);
  const isFree = totalCost <= 0;

  const model = {
    id,
    name,
    description,
    contextLength,
    supportedParameters: supportedParametersRaw,
    pricing: {
      prompt: String(prompt),
      completion: String(completion),
    },
    isFree,
  };

  const parsed = OpenRouterModelSchema.safeParse(model);
  return parsed.success ? parsed.data : null;
};

export const loadOpenRouterModelCache = (): OpenRouterModelCache | null => {
  const path = getGlobalOpenRouterModelsPath();
  const data = readJsonFileSync<OpenRouterModelCache>(path);
  if (!data) return null;
  const parsed = OpenRouterModelCacheSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
};

export const persistOpenRouterModelCache = (cache: OpenRouterModelCache): void => {
  const path = getGlobalOpenRouterModelsPath();
  writeJsonFileSync(path, cache);
};

export const fetchOpenRouterModels = async (apiKey: string): Promise<Result<OpenRouterModel[], { message: string }>> => {
  let response: Response;
  try {
    response = await fetch(OPENROUTER_MODELS_URL, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    return err({ message: getErrorMessage(error, "Failed to fetch OpenRouter models") });
  }

  if (!response.ok) {
    return err({ message: `OpenRouter models request failed: ${response.status}` });
  }

  const payload = (await response.json()) as unknown;
  const rawModels = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : [];
  if (!Array.isArray(rawModels)) {
    return err({ message: "OpenRouter models response is not an array" });
  }

  return ok(
    rawModels
      .map(mapOpenRouterModel)
      .filter((model): model is OpenRouterModel => model !== null)
  );
};

export const getOpenRouterModelsWithCache = async (
  apiKey: string
): Promise<Result<{ models: OpenRouterModel[]; fetchedAt: string; cached: boolean }, { message: string }>> => {
  const cache = loadOpenRouterModelCache();
  const cacheTime = cache ? Date.parse(cache.fetchedAt) : NaN;
  const cacheValid = Number.isFinite(cacheTime) && Date.now() - cacheTime < CACHE_TTL_MS;
  const cacheWithParams = cache
    ? cache.models.filter((model) => (model.supportedParameters?.length ?? 0) > 0).length
    : 0;
  const cacheHasParams = cacheWithParams > 0;

  if (cache && cacheValid && cacheHasParams) {
    console.info(
      `[openrouter-models] cache hit: models=${cache.models.length} withParams=${cacheWithParams}`
    );
    return ok({ models: cache.models, fetchedAt: cache.fetchedAt, cached: true });
  }

  const fetchResult = await fetchOpenRouterModels(apiKey);
  if (fetchResult.ok) {
    const models = fetchResult.value;
    const fetchedAt = new Date().toISOString();
    persistOpenRouterModelCache({ models, fetchedAt });
    const withParams = models.filter((model) => (model.supportedParameters?.length ?? 0) > 0)
      .length;
    console.info(
      `[openrouter-models] fetched: models=${models.length} withParams=${withParams} cacheWasValid=${cacheValid}`
    );
    return ok({ models, fetchedAt, cached: false });
  }

  if (cache) {
    console.info(
      `[openrouter-models] fetch failed, using cache: models=${cache.models.length} withParams=${cacheWithParams}`
    );
    return ok({ models: cache.models, fetchedAt: cache.fetchedAt, cached: true });
  }

  return err({ message: fetchResult.error.message });
};
