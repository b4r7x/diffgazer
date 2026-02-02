import { ok, err, type Result } from "@repo/core";
import { OpenRouterModelCacheSchema, type OpenRouterModel, type OpenRouterModelCache } from "@repo/schemas";
import { paths } from "./paths.js";
import fs from "node:fs/promises";
import path from "node:path";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const OPENROUTER_API = "https://openrouter.ai/api/v1/models";

export async function getOpenRouterModels(
  forceRefresh = false
): Promise<Result<OpenRouterModel[], Error>> {
  const cachePath = path.join(paths.config, "openrouter-models.json");

  // Check cache
  if (!forceRefresh) {
    try {
      const cached = await fs.readFile(cachePath, "utf-8");
      const parseResult = OpenRouterModelCacheSchema.safeParse(JSON.parse(cached));
      if (parseResult.success) {
        const age = Date.now() - new Date(parseResult.data.fetchedAt).getTime();
        if (age < CACHE_TTL_MS) {
          return ok(parseResult.data.models);
        }
      }
    } catch {
      // Cache miss, fetch fresh
    }
  }

  // Fetch from API
  try {
    const response = await fetch(OPENROUTER_API);
    if (!response.ok) {
      return err(new Error(`OpenRouter API error: ${response.status}`));
    }
    const json = (await response.json()) as { data: any[] };

    const models: OpenRouterModel[] = json.data.map((m: any) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      contextLength: m.context_length,
      pricing: {
        prompt: m.pricing.prompt,
        completion: m.pricing.completion,
      },
      isFree: m.pricing.prompt === "0" && m.pricing.completion === "0",
    }));

    // Save to cache with restricted permissions
    const cache: OpenRouterModelCache = {
      models,
      fetchedAt: new Date().toISOString(),
    };
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), { mode: 0o600 });

    return ok(models);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}
