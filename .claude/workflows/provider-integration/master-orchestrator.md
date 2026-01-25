# Provider Integration - Master Orchestrator

Add GLM (Z.ai) and OpenRouter providers to Stargazer with full agentic workflow visibility.

## Context

Stargazer is a local-only CLI tool for AI-powered code review. It uses:
- **Vercel AI SDK** for provider abstraction
- **Parallel agent execution** (Detective, Guardian, Optimizer, Simplifier, Tester)
- **SSE streaming** for real-time agent activity display

Current providers: Gemini, OpenAI, Anthropic

## Goal

Add two new providers:

### GLM (Z.ai)
- Package: `zhipu-ai-provider`
- Endpoints:
  - Standard: `https://open.bigmodel.cn/api/paas/v4`
  - Coding: `https://api.z.ai/api/coding/paas/v4` (DEFAULT for code review)
- Models: glm-4.6, glm-4.7
- Env var: `GLM_API_KEY` or `ZHIPU_API_KEY`

### OpenRouter
- Package: `@openrouter/ai-sdk-provider`
- Endpoint: `https://openrouter.ai/api/v1`
- Models: 400+ (fetched dynamically from API)
- Cache: `~/.config/stargazer/openrouter-models.json` (1-day TTL)
- Env var: `OPENROUTER_API_KEY`
- Show free models with badge in UI

---

## Pre-Flight

```bash
# Install dependencies first
pnpm add zhipu-ai-provider @openrouter/ai-sdk-provider
```

---

## Phase 1: Schema Updates

**Agent**: `typescript-pro`
**Validation**: `npm run type-check`

### Task 1.1: Update AI_PROVIDERS enum

File: `packages/schemas/src/config.ts`

Add to `AI_PROVIDERS` array:
```typescript
export const AI_PROVIDERS = ["gemini", "openai", "anthropic", "glm", "openrouter"] as const;
```

### Task 1.2: Define GLM models

Add after ANTHROPIC_MODELS:
```typescript
export const GLM_MODELS = ["glm-4.7", "glm-4.6"] as const;
export type GLMModel = (typeof GLM_MODELS)[number];

export const GLM_MODEL_INFO: Record<GLMModel, ModelInfo> = {
  "glm-4.7": {
    id: "glm-4.7",
    name: "GLM-4.7",
    description: "Latest GLM with 200K context, excellent for coding",
    tier: "paid",
    recommended: true,
  },
  "glm-4.6": {
    id: "glm-4.6",
    name: "GLM-4.6",
    description: "Previous generation GLM model",
    tier: "paid",
    recommended: false,
  },
};

export const GLM_ENDPOINTS = ["coding", "standard"] as const;
export type GLMEndpoint = (typeof GLM_ENDPOINTS)[number];
```

### Task 1.3: Define OpenRouter config

```typescript
// OpenRouter models are fetched dynamically - this is the cache schema
export const OpenRouterModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  contextLength: z.number(),
  pricing: z.object({
    prompt: z.string(),
    completion: z.string(),
  }),
  isFree: z.boolean(),
});

export type OpenRouterModel = z.infer<typeof OpenRouterModelSchema>;

export const OpenRouterModelCacheSchema = z.object({
  models: z.array(OpenRouterModelSchema),
  fetchedAt: z.string().datetime(),
});

export type OpenRouterModelCache = z.infer<typeof OpenRouterModelCacheSchema>;
```

### Task 1.4: Update AVAILABLE_PROVIDERS

Add GLM and OpenRouter to `AVAILABLE_PROVIDERS` array:
```typescript
{
  id: "glm",
  name: "GLM (Z.ai)",
  defaultModel: "glm-4.7",
  models: GLM_MODELS,
},
{
  id: "openrouter",
  name: "OpenRouter",
  defaultModel: "", // Dynamic - user must select
  models: [], // Dynamic - fetched from API
},
```

### Task 1.5: Update UserConfigSchema

Add optional fields for GLM endpoint and OpenRouter model:
```typescript
export const UserConfigSchema = z.object({
  provider: AIProviderSchema,
  model: z.string().optional(),
  glmEndpoint: z.enum(GLM_ENDPOINTS).optional().default("coding"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

### Task 1.6: Export new types

Update `packages/schemas/src/index.ts` to export all new types.

---

## Phase 2: Core SDK Integration

**Agent**: `backend-architect`
**Validation**: `npm run type-check`

### Task 2.1: Update createLanguageModel

File: `packages/core/src/ai/sdk-client.ts`

Add imports:
```typescript
import { createZhipu } from "zhipu-ai-provider";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
```

Add cases to `createLanguageModel()` switch:
```typescript
case "glm": {
  const zhipu = createZhipu({
    apiKey: config.apiKey,
    baseURL: config.glmEndpoint === "coding"
      ? "https://api.z.ai/api/coding/paas/v4"
      : "https://open.bigmodel.cn/api/paas/v4",
  });
  return zhipu(config.model || "glm-4.7");
}

case "openrouter": {
  const openrouter = createOpenRouter({
    apiKey: config.apiKey,
  });
  return openrouter(config.model); // Model required for OpenRouter
}
```

### Task 2.2: Update AIClientConfig type

File: `packages/core/src/ai/types.ts`

```typescript
export interface AIClientConfig {
  apiKey: string;
  provider: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  glmEndpoint?: "coding" | "standard"; // Add this
}
```

### Task 2.3: Update error classifier

File: `packages/core/src/ai/errors.ts`

Add GLM and OpenRouter error patterns if needed (both use OpenAI-compatible format, so existing patterns may work).

---

## Phase 3: API Routes

**Agent**: `backend-developer`
**Validation**: `npm run type-check && npx vitest run apps/server`

### Task 3.1: Add OpenRouter models endpoint

File: `apps/server/src/api/routes/config.ts`

Add new route:
```typescript
// GET /config/openrouter/models - Fetch available OpenRouter models
.get("/openrouter/models", async (c) => {
  const forceRefresh = c.req.query("refresh") === "true";
  const models = await getOpenRouterModels(forceRefresh);
  return c.json({ models });
})
```

### Task 3.2: Create OpenRouter model fetcher

File: `packages/core/src/storage/openrouter-models.ts`

```typescript
import { Result, ok, err } from "../result";
import { OpenRouterModel, OpenRouterModelCache } from "@repo/schemas";
import { getSettingsPaths } from "./paths";
import fs from "fs/promises";
import path from "path";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 1 day
const OPENROUTER_API = "https://openrouter.ai/api/v1/models";

export async function getOpenRouterModels(
  forceRefresh = false
): Promise<Result<OpenRouterModel[], Error>> {
  const cachePath = path.join(getSettingsPaths().configDir, "openrouter-models.json");

  // Check cache
  if (!forceRefresh) {
    try {
      const cached = await fs.readFile(cachePath, "utf-8");
      const data: OpenRouterModelCache = JSON.parse(cached);
      const age = Date.now() - new Date(data.fetchedAt).getTime();
      if (age < CACHE_TTL_MS) {
        return ok(data.models);
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
    const json = await response.json();

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

    // Save to cache
    const cache: OpenRouterModelCache = {
      models,
      fetchedAt: new Date().toISOString(),
    };
    await fs.mkdir(path.dirname(cachePath), { recursive: true });
    await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));

    return ok(models);
  } catch (e) {
    return err(e instanceof Error ? e : new Error(String(e)));
  }
}
```

### Task 3.3: Update config save to handle GLM endpoint

In POST `/config` handler, extract and save `glmEndpoint` from request body.

### Task 3.4: Add env var detection for new providers

Update the env var map:
```typescript
const PROVIDER_ENV_VARS: Record<AIProvider, string> = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  glm: "GLM_API_KEY", // Also check ZHIPU_API_KEY as fallback
  openrouter: "OPENROUTER_API_KEY",
};
```

---

## Phase 4: CLI UI

**Agent**: `frontend-developer`
**Validation**: `npm run type-check`

### Task 4.1: Update provider step

File: `apps/cli/src/components/wizard/provider-step.tsx`

- Add GLM and OpenRouter to provider list
- Show "Coding Endpoint" badge for GLM
- Show "400+ Models" badge for OpenRouter

### Task 4.2: Create OpenRouter model selector

File: `apps/cli/src/components/wizard/openrouter-model-step.tsx`

New component with:
- Search input for filtering models
- Free tier filter toggle
- Model list with badges (free, context length)
- Pagination or virtual scrolling for 400+ models

```typescript
interface Props {
  models: OpenRouterModel[];
  onSelect: (modelId: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
}
```

### Task 4.3: Add GLM endpoint toggle

File: `apps/cli/src/components/wizard/glm-endpoint-step.tsx`

Simple toggle:
- Coding Endpoint (Recommended for code review)
- Standard Endpoint

### Task 4.4: Update model step routing

File: `apps/cli/src/components/wizard/model-step.tsx`

When provider is "openrouter", show OpenRouterModelStep instead of static list.
When provider is "glm", show GLM models + endpoint toggle.

### Task 4.5: Update env var detection

File: `apps/cli/src/app/screens/onboarding-screen.tsx`
File: `apps/cli/src/app/screens/settings-screen.tsx`

Add to `PROVIDER_ENV_VARS`:
```typescript
glm: "GLM_API_KEY",
openrouter: "OPENROUTER_API_KEY",
```

Also check `ZHIPU_API_KEY` as fallback for GLM.

---

## Phase 5: Security Review

**Agent**: `code-reviewer`
**Focus**: New provider code only

### Checklist

- [ ] API keys stored via existing secrets system (keyring/vault/env)
- [ ] No API keys logged or exposed in errors
- [ ] OpenRouter model fetch uses HTTPS
- [ ] Cache file permissions (0o600)
- [ ] Input validation on model selection
- [ ] No injection in model IDs passed to SDK

---

## Phase 6: Tests

**Agent**: `test-automator`
**Validation**: `npx vitest run`

### Task 6.1: Schema tests

File: `packages/schemas/src/config.test.ts`

- Test GLM model validation
- Test OpenRouter model cache schema
- Test UserConfig with glmEndpoint

### Task 6.2: OpenRouter model fetcher tests

File: `packages/core/src/storage/openrouter-models.test.ts`

- Test cache hit (within TTL)
- Test cache miss (expired)
- Test force refresh
- Test API error handling
- Mock fetch for tests

### Task 6.3: SDK client tests

File: `packages/core/src/ai/sdk-client.test.ts`

- Test GLM provider creation (both endpoints)
- Test OpenRouter provider creation
- Test error handling for missing model (OpenRouter)

---

## Validation Checkpoints

After each phase, run:

```bash
# Type checking
npm run type-check

# Unit tests (after Phase 3+)
npx vitest run

# Integration test (after Phase 4)
./scripts/test-integration.sh
```

## Success Criteria

1. `stargazer config` shows GLM and OpenRouter as provider options
2. GLM defaults to coding endpoint
3. OpenRouter shows searchable model list with free badges
4. Model cache refreshes after 1 day or manual refresh
5. All existing tests pass
6. New providers work in review flow with agent activity display
