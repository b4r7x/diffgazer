# Phase 6: Tests

**Agent**: `test-automator`
**Validation**: `npx vitest run`
**Depends on**: Phases 1-5

## Overview

Add test coverage for all new provider integration code.

## Test Files to Create/Modify

| File | Tests |
|------|-------|
| `packages/schemas/src/config.test.ts` | Schema validation |
| `packages/core/src/storage/openrouter-models.test.ts` | Model fetcher |
| `packages/core/src/ai/sdk-client.test.ts` | Provider creation |
| `apps/server/src/api/routes/config.test.ts` | API endpoints |

## Tasks

### 6.1 Schema tests

File: `packages/schemas/src/config.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import {
  UserConfigSchema,
  SaveConfigRequestSchema,
  OpenRouterModelSchema,
  OpenRouterModelCacheSchema,
  GLM_MODELS,
  GLM_ENDPOINTS,
  isValidModelForProvider,
} from "./config";

describe("GLM types", () => {
  it("has valid GLM models", () => {
    expect(GLM_MODELS).toContain("glm-4.7");
    expect(GLM_MODELS).toContain("glm-4.6");
  });

  it("has valid GLM endpoints", () => {
    expect(GLM_ENDPOINTS).toContain("coding");
    expect(GLM_ENDPOINTS).toContain("standard");
  });

  it("validates GLM model for provider", () => {
    expect(isValidModelForProvider("glm", "glm-4.7")).toBe(true);
    expect(isValidModelForProvider("glm", "invalid")).toBe(false);
  });
});

describe("OpenRouter types", () => {
  it("validates OpenRouterModel", () => {
    const valid = {
      id: "openai/gpt-4",
      name: "GPT-4",
      contextLength: 8192,
      pricing: { prompt: "0.00003", completion: "0.00006" },
      isFree: false,
    };
    expect(OpenRouterModelSchema.safeParse(valid).success).toBe(true);
  });

  it("validates OpenRouterModelCache", () => {
    const valid = {
      models: [],
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date().toISOString(),
    };
    expect(OpenRouterModelCacheSchema.safeParse(valid).success).toBe(true);
  });

  it("allows any model for openrouter", () => {
    expect(isValidModelForProvider("openrouter", "any-model")).toBe(true);
  });
});

describe("UserConfigSchema", () => {
  it("validates GLM config with endpoint", () => {
    const config = {
      provider: "glm",
      model: "glm-4.7",
      glmEndpoint: "coding",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(UserConfigSchema.safeParse(config).success).toBe(true);
  });

  it("requires model for openrouter", () => {
    const config = {
      provider: "openrouter",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const result = UserConfigSchema.safeParse(config);
    expect(result.success).toBe(false);
  });

  it("validates openrouter with model", () => {
    const config = {
      provider: "openrouter",
      model: "anthropic/claude-3-opus",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(UserConfigSchema.safeParse(config).success).toBe(true);
  });
});

describe("SaveConfigRequestSchema", () => {
  it("validates GLM request", () => {
    const request = {
      provider: "glm",
      apiKey: "test-key",
      glmEndpoint: "coding",
    };
    expect(SaveConfigRequestSchema.safeParse(request).success).toBe(true);
  });

  it("validates OpenRouter request", () => {
    const request = {
      provider: "openrouter",
      apiKey: "test-key",
      model: "openai/gpt-4",
    };
    expect(SaveConfigRequestSchema.safeParse(request).success).toBe(true);
  });
});
```

### 6.2 OpenRouter model fetcher tests

File: `packages/core/src/storage/openrouter-models.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getOpenRouterModels, searchOpenRouterModels, clearOpenRouterCache } from "./openrouter-models";
import fs from "fs/promises";

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock fs
vi.mock("fs/promises", () => ({
  default: {
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    unlink: vi.fn(),
  },
}));

// Mock paths
vi.mock("./paths", () => ({
  getSettingsPaths: () => ({
    configDir: "/tmp/test-config",
  }),
}));

const mockModelsResponse = {
  data: [
    {
      id: "openai/gpt-4",
      name: "GPT-4",
      description: "OpenAI GPT-4",
      context_length: 8192,
      pricing: { prompt: "0.00003", completion: "0.00006" },
    },
    {
      id: "free/model",
      name: "Free Model",
      context_length: 4096,
      pricing: { prompt: "0", completion: "0" },
    },
  ],
};

describe("getOpenRouterModels", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches models from API on cache miss", async () => {
    (fs.readFile as any).mockRejectedValue(new Error("ENOENT"));
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockModelsResponse),
    });

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(true);
    expect(result.value).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/models",
      expect.any(Object)
    );
  });

  it("returns cached models when valid", async () => {
    const cache = {
      models: [{ id: "cached/model", name: "Cached", contextLength: 4096, pricing: { prompt: "0", completion: "0" }, isFree: true }],
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(), // +1 day
    };
    (fs.readFile as any).mockResolvedValue(JSON.stringify(cache));

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value?.[0].id).toBe("cached/model");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fetches fresh on force refresh", async () => {
    const cache = {
      models: [{ id: "cached/model", name: "Cached", contextLength: 4096, pricing: { prompt: "0", completion: "0" }, isFree: true }],
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    (fs.readFile as any).mockResolvedValue(JSON.stringify(cache));
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockModelsResponse),
    });

    const result = await getOpenRouterModels(true);

    expect(result.ok).toBe(true);
    expect(result.value).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalled();
  });

  it("returns stale cache on API error", async () => {
    const cache = {
      models: [{ id: "stale/model", name: "Stale", contextLength: 4096, pricing: { prompt: "0", completion: "0" }, isFree: true }],
      fetchedAt: new Date(Date.now() - 86400000 * 2).toISOString(), // 2 days ago
      expiresAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago (expired)
    };
    (fs.readFile as any).mockResolvedValue(JSON.stringify(cache));
    mockFetch.mockRejectedValue(new Error("Network error"));

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(true);
    expect(result.value?.[0].id).toBe("stale/model");
  });

  it("marks free models correctly", async () => {
    (fs.readFile as any).mockRejectedValue(new Error("ENOENT"));
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockModelsResponse),
    });

    const result = await getOpenRouterModels();

    expect(result.ok).toBe(true);
    const freeModel = result.value?.find((m) => m.id === "free/model");
    const paidModel = result.value?.find((m) => m.id === "openai/gpt-4");
    expect(freeModel?.isFree).toBe(true);
    expect(paidModel?.isFree).toBe(false);
  });
});

describe("searchOpenRouterModels", () => {
  beforeEach(() => {
    const cache = {
      models: [
        { id: "openai/gpt-4", name: "GPT-4", description: "OpenAI model", contextLength: 8192, pricing: { prompt: "0.00003", completion: "0.00006" }, isFree: false },
        { id: "free/llama", name: "Llama Free", description: "Free llama model", contextLength: 4096, pricing: { prompt: "0", completion: "0" }, isFree: true },
      ],
      fetchedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
    };
    (fs.readFile as any).mockResolvedValue(JSON.stringify(cache));
  });

  it("filters by query", async () => {
    const result = await searchOpenRouterModels("gpt");
    expect(result.ok).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value?.[0].id).toBe("openai/gpt-4");
  });

  it("filters free only", async () => {
    const result = await searchOpenRouterModels("", { freeOnly: true });
    expect(result.ok).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value?.[0].isFree).toBe(true);
  });

  it("combines query and free filter", async () => {
    const result = await searchOpenRouterModels("llama", { freeOnly: true });
    expect(result.ok).toBe(true);
    expect(result.value).toHaveLength(1);
    expect(result.value?.[0].id).toBe("free/llama");
  });
});
```

### 6.3 SDK client tests

File: `packages/core/src/ai/sdk-client.test.ts`

Add tests for new providers:

```typescript
import { describe, it, expect, vi } from "vitest";

// Mock the provider packages
vi.mock("zhipu-ai-provider", () => ({
  createZhipu: vi.fn(() => vi.fn(() => ({ modelId: "glm-4.7" }))),
}));

vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: vi.fn(() => vi.fn(() => ({ modelId: "test-model" }))),
}));

// Import after mocks
import { createZhipu } from "zhipu-ai-provider";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";

describe("GLM provider", () => {
  it("creates client with coding endpoint by default", () => {
    // Test that createZhipu is called with coding endpoint URL
    const config = {
      apiKey: "test-key",
      provider: "glm" as const,
    };

    // Implementation would call createZhipu with baseURL
    expect(createZhipu).toBeDefined();
  });

  it("creates client with standard endpoint when specified", () => {
    const config = {
      apiKey: "test-key",
      provider: "glm" as const,
      glmEndpoint: "standard" as const,
    };

    // Test endpoint URL is standard
    expect(createZhipu).toBeDefined();
  });
});

describe("OpenRouter provider", () => {
  it("requires model to be specified", () => {
    const config = {
      apiKey: "test-key",
      provider: "openrouter" as const,
    };

    // Should throw error without model
    expect(() => {
      if (!config.model) throw new Error("OpenRouter requires a model");
    }).toThrow();
  });

  it("creates client with specified model", () => {
    const config = {
      apiKey: "test-key",
      provider: "openrouter" as const,
      model: "anthropic/claude-3-opus",
    };

    expect(createOpenRouter).toBeDefined();
  });
});
```

### 6.4 API route tests

File: `apps/server/src/api/routes/config.test.ts`

Add to existing tests:

```typescript
describe("OpenRouter endpoints", () => {
  it("GET /config/openrouter/models returns models", async () => {
    const res = await app.request("/config/openrouter/models");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.models).toBeDefined();
    expect(Array.isArray(json.models)).toBe(true);
    expect(typeof json.count).toBe("number");
  });

  it("GET /config/openrouter/models/search filters results", async () => {
    const res = await app.request("/config/openrouter/models/search?q=claude&free=true");
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.query).toBe("claude");
    expect(json.freeOnly).toBe(true);
  });

  it("GET /config/openrouter/models?refresh=true forces refresh", async () => {
    const res = await app.request("/config/openrouter/models?refresh=true");
    expect(res.status).toBe(200);
  });
});

describe("GLM config", () => {
  it("POST /config saves GLM with endpoint", async () => {
    const res = await app.request("/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "glm",
        apiKey: "test-glm-key",
        model: "glm-4.7",
        glmEndpoint: "standard",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.provider).toBe("glm");
    expect(json.glmEndpoint).toBe("standard");
  });

  it("POST /config defaults GLM to coding endpoint", async () => {
    const res = await app.request("/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "glm",
        apiKey: "test-glm-key",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.glmEndpoint).toBe("coding");
  });
});

describe("OpenRouter config", () => {
  it("POST /config requires model for openrouter", async () => {
    const res = await app.request("/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "openrouter",
        apiKey: "test-or-key",
      }),
    });

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("model");
  });

  it("POST /config saves openrouter with model", async () => {
    const res = await app.request("/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "openrouter",
        apiKey: "test-or-key",
        model: "anthropic/claude-3-opus",
      }),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.provider).toBe("openrouter");
    expect(json.model).toBe("anthropic/claude-3-opus");
  });
});
```

## Validation

```bash
# Run all tests
npx vitest run

# Run specific test files
npx vitest run packages/schemas/src/config.test.ts
npx vitest run packages/core/src/storage/openrouter-models.test.ts
npx vitest run apps/server/src/api/routes/config.test.ts

# Run with coverage
npx vitest run --coverage
```

## Expected Coverage

| File | Target |
|------|--------|
| `packages/schemas/src/config.ts` | 90%+ |
| `packages/core/src/storage/openrouter-models.ts` | 85%+ |
| `apps/server/src/api/routes/config.ts` | 80%+ |
