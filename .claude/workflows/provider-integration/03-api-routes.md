# Phase 3: API Routes

**Agent**: `backend-developer`
**Validation**: `npm run type-check && npx vitest run apps/server`
**Depends on**: Phase 1, Phase 2

## Overview

Add API endpoints for OpenRouter model fetching and update config routes for new providers.

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `packages/core/src/storage/openrouter-models.ts` | CREATE | Model fetcher with cache |
| `packages/core/src/storage/index.ts` | MODIFY | Export new module |
| `apps/server/src/api/routes/config.ts` | MODIFY | Add OpenRouter endpoints |
| `packages/core/src/secrets/index.ts` | MODIFY | Add env var fallbacks |

## Tasks

### 3.1 Create OpenRouter model fetcher

File: `packages/core/src/storage/openrouter-models.ts`

```typescript
import { Result, ok, err } from "../result";
import { OpenRouterModel, OpenRouterModelCache, OpenRouterModelCacheSchema } from "@repo/schemas";
import { getSettingsPaths } from "./paths";
import fs from "fs/promises";
import path from "path";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const OPENROUTER_MODELS_API = "https://openrouter.ai/api/v1/models";

interface OpenRouterAPIModel {
  id: string;
  name: string;
  description?: string;
  context_length: number;
  pricing: {
    prompt: string;
    completion: string;
  };
  top_provider?: {
    context_length?: number;
  };
}

function transformModel(m: OpenRouterAPIModel): OpenRouterModel {
  const isFree = m.pricing.prompt === "0" && m.pricing.completion === "0";
  return {
    id: m.id,
    name: m.name,
    description: m.description,
    contextLength: m.context_length,
    pricing: {
      prompt: m.pricing.prompt,
      completion: m.pricing.completion,
    },
    isFree,
    topProvider: m.top_provider?.context_length?.toString(),
  };
}

function getCachePath(): string {
  return path.join(getSettingsPaths().configDir, "openrouter-models.json");
}

async function readCache(): Promise<OpenRouterModelCache | null> {
  try {
    const data = await fs.readFile(getCachePath(), "utf-8");
    const parsed = JSON.parse(data);
    const validated = OpenRouterModelCacheSchema.safeParse(parsed);
    if (validated.success) {
      return validated.data;
    }
    return null;
  } catch {
    return null;
  }
}

async function writeCache(models: OpenRouterModel[]): Promise<void> {
  const now = new Date();
  const cache: OpenRouterModelCache = {
    models,
    fetchedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + CACHE_TTL_MS).toISOString(),
  };

  const cachePath = getCachePath();
  await fs.mkdir(path.dirname(cachePath), { recursive: true });
  await fs.writeFile(cachePath, JSON.stringify(cache, null, 2), { mode: 0o600 });
}

function isCacheValid(cache: OpenRouterModelCache): boolean {
  const expiresAt = new Date(cache.expiresAt).getTime();
  return Date.now() < expiresAt;
}

export async function getOpenRouterModels(
  forceRefresh = false
): Promise<Result<OpenRouterModel[], Error>> {
  // Check cache unless force refresh
  if (!forceRefresh) {
    const cache = await readCache();
    if (cache && isCacheValid(cache)) {
      return ok(cache.models);
    }
  }

  // Fetch from API
  try {
    const response = await fetch(OPENROUTER_MODELS_API, {
      headers: {
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      return err(new Error(`OpenRouter API error: ${response.status} ${response.statusText}`));
    }

    const json = await response.json();

    if (!json.data || !Array.isArray(json.data)) {
      return err(new Error("Invalid OpenRouter API response format"));
    }

    const models: OpenRouterModel[] = json.data.map(transformModel);

    // Sort: free first, then by name
    models.sort((a, b) => {
      if (a.isFree !== b.isFree) return a.isFree ? -1 : 1;
      return a.name.localeCompare(b.name);
    });

    // Write to cache
    await writeCache(models);

    return ok(models);
  } catch (e) {
    // Try to return stale cache on error
    const cache = await readCache();
    if (cache) {
      return ok(cache.models);
    }
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}

export async function searchOpenRouterModels(
  query: string,
  options?: { freeOnly?: boolean }
): Promise<Result<OpenRouterModel[], Error>> {
  const modelsResult = await getOpenRouterModels();
  if (!modelsResult.ok) return modelsResult;

  let filtered = modelsResult.value;

  // Filter by free
  if (options?.freeOnly) {
    filtered = filtered.filter((m) => m.isFree);
  }

  // Filter by search query
  if (query.trim()) {
    const q = query.toLowerCase();
    filtered = filtered.filter(
      (m) =>
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q)
    );
  }

  return ok(filtered);
}

export async function clearOpenRouterCache(): Promise<void> {
  try {
    await fs.unlink(getCachePath());
  } catch {
    // Ignore if file doesn't exist
  }
}
```

### 3.2 Export from storage index

File: `packages/core/src/storage/index.ts`

```typescript
export {
  getOpenRouterModels,
  searchOpenRouterModels,
  clearOpenRouterCache,
} from "./openrouter-models";
```

### 3.3 Add OpenRouter routes

File: `apps/server/src/api/routes/config.ts`

Add new routes:

```typescript
import { getOpenRouterModels, searchOpenRouterModels } from "@repo/core/storage";

// Add to config router:

// GET /config/openrouter/models - Get cached OpenRouter models
.get("/openrouter/models", async (c) => {
  const refresh = c.req.query("refresh") === "true";
  const result = await getOpenRouterModels(refresh);

  if (!result.ok) {
    return c.json({ error: result.error.message }, 500);
  }

  return c.json({
    models: result.value,
    count: result.value.length,
  });
})

// GET /config/openrouter/models/search - Search OpenRouter models
.get("/openrouter/models/search", async (c) => {
  const query = c.req.query("q") || "";
  const freeOnly = c.req.query("free") === "true";

  const result = await searchOpenRouterModels(query, { freeOnly });

  if (!result.ok) {
    return c.json({ error: result.error.message }, 500);
  }

  return c.json({
    models: result.value,
    count: result.value.length,
    query,
    freeOnly,
  });
})
```

### 3.4 Update config POST to handle glmEndpoint

In the POST `/config` handler:

```typescript
.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = SaveConfigRequestSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: "Invalid request", details: parsed.error.flatten() }, 400);
  }

  const { provider, apiKey, model, glmEndpoint } = parsed.data;

  // Validate OpenRouter model requirement
  if (provider === "openrouter" && !model) {
    return c.json({ error: "OpenRouter requires a model to be selected" }, 400);
  }

  // Store API key
  const stored = await setApiKey(provider, apiKey);
  if (!stored) {
    return c.json({ error: "Failed to store API key" }, 500);
  }

  // Verify API key was stored
  const verify = await getApiKey(provider);
  if (!verify) {
    return c.json({ error: "Failed to verify stored API key" }, 500);
  }

  // Save config
  const now = new Date().toISOString();
  const config: UserConfig = {
    provider,
    model,
    glmEndpoint: provider === "glm" ? (glmEndpoint || "coding") : undefined,
    createdAt: now,
    updatedAt: now,
  };

  await configStore.write(config);

  return c.json({
    provider,
    model: model || getDefaultModel(provider),
    glmEndpoint: config.glmEndpoint,
  });
})
```

### 3.5 Update env var detection for new providers

File: `packages/core/src/secrets/index.ts`

Update `getEnvApiKey`:

```typescript
function getEnvApiKey(provider: AIProvider): string | undefined {
  const envVars: Record<AIProvider, string[]> = {
    gemini: ["GEMINI_API_KEY"],
    openai: ["OPENAI_API_KEY"],
    anthropic: ["ANTHROPIC_API_KEY"],
    glm: ["GLM_API_KEY", "ZHIPU_API_KEY"], // Check both
    openrouter: ["OPENROUTER_API_KEY"],
  };

  const vars = envVars[provider] || [];
  for (const v of vars) {
    const value = process.env[v];
    if (value) return value;
  }
  return undefined;
}
```

### 3.6 Add test for config routes

File: `apps/server/src/api/routes/config.test.ts`

Add tests for new endpoints:

```typescript
describe("OpenRouter routes", () => {
  it("GET /config/openrouter/models returns model list", async () => {
    const res = await app.request("/config/openrouter/models");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.models).toBeDefined();
    expect(Array.isArray(json.models)).toBe(true);
  });

  it("GET /config/openrouter/models/search filters by query", async () => {
    const res = await app.request("/config/openrouter/models/search?q=gpt");
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.query).toBe("gpt");
  });

  it("GET /config/openrouter/models/search filters free models", async () => {
    const res = await app.request("/config/openrouter/models/search?free=true");
    expect(res.status).toBe(200);
    const json = await res.json();
    json.models.forEach((m: any) => {
      expect(m.isFree).toBe(true);
    });
  });
});

describe("GLM config", () => {
  it("POST /config with GLM defaults to coding endpoint", async () => {
    const res = await app.request("/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "glm",
        apiKey: "test-key",
      }),
    });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.glmEndpoint).toBe("coding");
  });
});
```

## Validation

```bash
npm run type-check
npx vitest run apps/server
```
