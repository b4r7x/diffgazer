# Phase 1: Schema Updates

**Agent**: `typescript-pro`
**Validation**: `npm run type-check`

## Overview

Update Zod schemas to support GLM and OpenRouter providers.

## Files to Modify

| File | Changes |
|------|---------|
| `packages/schemas/src/config.ts` | Add providers, models, types |
| `packages/schemas/src/index.ts` | Export new types |

## Tasks

### 1.1 Update AI_PROVIDERS enum

```typescript
// packages/schemas/src/config.ts

export const AI_PROVIDERS = ["gemini", "openai", "anthropic", "glm", "openrouter"] as const;
```

### 1.2 Define GLM models and endpoints

Add after `ANTHROPIC_MODEL_INFO`:

```typescript
// GLM (Z.ai) Models
export const GLM_MODELS = ["glm-4.7", "glm-4.6"] as const;
export type GLMModel = (typeof GLM_MODELS)[number];

export const GLM_MODEL_INFO: Record<GLMModel, ModelInfo> = {
  "glm-4.7": {
    id: "glm-4.7",
    name: "GLM-4.7",
    description: "Latest GLM with 200K context, MoE architecture, excellent for coding",
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

// GLM has two endpoints - coding is optimized for code tasks
export const GLM_ENDPOINTS = ["coding", "standard"] as const;
export type GLMEndpoint = (typeof GLM_ENDPOINTS)[number];

export const GLM_ENDPOINT_INFO: Record<GLMEndpoint, { name: string; description: string; url: string }> = {
  coding: {
    name: "Coding Endpoint",
    description: "Optimized for code review and programming tasks (recommended)",
    url: "https://api.z.ai/api/coding/paas/v4",
  },
  standard: {
    name: "Standard Endpoint",
    description: "General-purpose endpoint",
    url: "https://open.bigmodel.cn/api/paas/v4",
  },
};
```

### 1.3 Define OpenRouter schemas

OpenRouter models are fetched dynamically. Define cache schema:

```typescript
// OpenRouter - models fetched dynamically from API
export const OpenRouterModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  contextLength: z.number(),
  pricing: z.object({
    prompt: z.string(), // USD per token as string (e.g., "0.000001")
    completion: z.string(),
  }),
  isFree: z.boolean(),
  topProvider: z.string().optional(),
});

export type OpenRouterModel = z.infer<typeof OpenRouterModelSchema>;

export const OpenRouterModelCacheSchema = z.object({
  models: z.array(OpenRouterModelSchema),
  fetchedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
});

export type OpenRouterModelCache = z.infer<typeof OpenRouterModelCacheSchema>;

// Placeholder for static provider info
export const OPENROUTER_MODELS: readonly string[] = []; // Dynamic
export type OpenRouterModelId = string; // Any string - validated against cache
```

### 1.4 Update AVAILABLE_PROVIDERS

Add to the array:

```typescript
export const AVAILABLE_PROVIDERS: readonly ProviderInfo[] = [
  // ... existing providers ...
  {
    id: "glm",
    name: "GLM (Z.ai)",
    defaultModel: "glm-4.7",
    models: GLM_MODELS,
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    defaultModel: "", // Must be selected by user
    models: OPENROUTER_MODELS, // Empty - fetched dynamically
  },
] as const;
```

### 1.5 Update UserConfigSchema

Add optional `glmEndpoint` field:

```typescript
export const UserConfigSchema = z.object({
  provider: AIProviderSchema,
  model: z.string().optional(),
  glmEndpoint: z.enum(GLM_ENDPOINTS).optional(), // Only used when provider is "glm"
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}).refine(
  (data) => {
    // GLM and static providers: validate model if provided
    if (data.provider !== "openrouter" && data.model) {
      return isValidModelForProvider(data.provider, data.model);
    }
    // OpenRouter: model is required
    if (data.provider === "openrouter") {
      return !!data.model; // Must have a model selected
    }
    return true;
  },
  { message: "Invalid model for selected provider" }
);
```

### 1.6 Update SaveConfigRequestSchema

```typescript
export const SaveConfigRequestSchema = z.object({
  provider: AIProviderSchema,
  apiKey: z.string().min(1),
  model: z.string().optional(),
  glmEndpoint: z.enum(GLM_ENDPOINTS).optional(),
});
```

### 1.7 Update helper functions

```typescript
export function getModelsForProvider(provider: AIProvider): readonly string[] {
  switch (provider) {
    case "gemini": return GEMINI_MODELS;
    case "openai": return OPENAI_MODELS;
    case "anthropic": return ANTHROPIC_MODELS;
    case "glm": return GLM_MODELS;
    case "openrouter": return OPENROUTER_MODELS; // Empty - use dynamic fetch
    default: return [];
  }
}

export function getModelInfo(provider: AIProvider, model: string): ModelInfo | undefined {
  switch (provider) {
    case "gemini": return GEMINI_MODEL_INFO[model as GeminiModel];
    case "openai": return OPENAI_MODEL_INFO[model as OpenAIModel];
    case "anthropic": return ANTHROPIC_MODEL_INFO[model as AnthropicModel];
    case "glm": return GLM_MODEL_INFO[model as GLMModel];
    case "openrouter": return undefined; // Use OpenRouterModel from cache
    default: return undefined;
  }
}

export function isValidModelForProvider(provider: AIProvider, model: string): boolean {
  if (provider === "openrouter") return true; // Validated against cache elsewhere
  const models = getModelsForProvider(provider);
  return models.includes(model);
}
```

### 1.8 Export new types

Update `packages/schemas/src/index.ts`:

```typescript
export {
  // ... existing exports ...
  GLM_MODELS,
  GLM_MODEL_INFO,
  GLM_ENDPOINTS,
  GLM_ENDPOINT_INFO,
  OpenRouterModelSchema,
  OpenRouterModelCacheSchema,
  type GLMModel,
  type GLMEndpoint,
  type OpenRouterModel,
  type OpenRouterModelCache,
} from "./config";
```

## Validation

```bash
npm run type-check
```

All type errors should be resolved. Downstream code may show errors until Phase 2 completes.
