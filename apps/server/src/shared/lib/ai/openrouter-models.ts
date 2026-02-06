import { getErrorMessage } from "@stargazer/core";
import {
  OpenRouterModelCacheSchema,
  OpenRouterModelSchema,
  type OpenRouterModel,
  type OpenRouterModelCache,
} from "@stargazer/schemas/config";
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

const mapOpenRouterModel = (raw: any): OpenRouterModel | null => {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id : "";
  if (!id) return null;

  const name = typeof raw.name === "string" ? raw.name : id;
  const description = typeof raw.description === "string" ? raw.description : undefined;

  const contextLengthRaw =
    raw.context_length ??
    raw.context_window ??
    raw.contextLength ??
    raw.contextWindow ??
    raw?.top_provider?.context_length ??
    raw?.top_provider?.contextLength;
  const contextLength = Number.isFinite(Number(contextLengthRaw))
    ? Number(contextLengthRaw)
    : 0;

  const supportedParametersRaw = Array.isArray(raw.supported_parameters)
    ? raw.supported_parameters
    : Array.isArray(raw.supportedParameters)
      ? raw.supportedParameters
      : undefined;

  const pricingRaw = raw.pricing ?? {};
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

export const fetchOpenRouterModels = async (apiKey: string): Promise<OpenRouterModel[]> => {
  const response = await fetch(OPENROUTER_MODELS_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`OpenRouter models request failed: ${response.status}`);
  }

  const payload = (await response.json()) as unknown;
  const rawModels = Array.isArray(payload)
    ? payload
    : payload && typeof payload === "object" && "data" in payload
      ? (payload as { data: unknown }).data
      : [];
  if (!Array.isArray(rawModels)) {
    throw new Error("OpenRouter models response is not an array");
  }

  return rawModels
    .map(mapOpenRouterModel)
    .filter((model): model is OpenRouterModel => model !== null);
};

export const getOpenRouterModelsWithCache = async (
  apiKey: string
): Promise<{ models: OpenRouterModel[]; fetchedAt: string; cached: boolean }> => {
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
    return { models: cache.models, fetchedAt: cache.fetchedAt, cached: true };
  }

  try {
    const models = await fetchOpenRouterModels(apiKey);
    const fetchedAt = new Date().toISOString();
    persistOpenRouterModelCache({ models, fetchedAt });
    const withParams = models.filter((model) => (model.supportedParameters?.length ?? 0) > 0)
      .length;
    console.info(
      `[openrouter-models] fetched: models=${models.length} withParams=${withParams} cacheWasValid=${cacheValid}`
    );
    return { models, fetchedAt, cached: false };
  } catch (error) {
    if (cache) {
      console.info(
        `[openrouter-models] fetch failed, using cache: models=${cache.models.length} withParams=${cacheWithParams}`
      );
      return { models: cache.models, fetchedAt: cache.fetchedAt, cached: true };
    }
    throw new Error(getErrorMessage(error, "Failed to fetch OpenRouter models"));
  }
};
