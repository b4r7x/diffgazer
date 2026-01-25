# Phase 2: Core SDK Integration

**Agent**: `backend-architect`
**Validation**: `npm run type-check`
**Depends on**: Phase 1 (Schema Updates)

## Overview

Integrate GLM and OpenRouter providers into the Vercel AI SDK client layer.

## Pre-requisites

```bash
pnpm add zhipu-ai-provider @openrouter/ai-sdk-provider
```

## Files to Modify

| File | Changes |
|------|---------|
| `packages/core/src/ai/sdk-client.ts` | Add provider cases |
| `packages/core/src/ai/types.ts` | Update config interface |
| `packages/core/src/ai/index.ts` | Export updates |

## Tasks

### 2.1 Update AIClientConfig interface

File: `packages/core/src/ai/types.ts`

```typescript
import type { AIProvider, GLMEndpoint } from "@repo/schemas";

export interface AIClientConfig {
  apiKey: string;
  provider: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  glmEndpoint?: GLMEndpoint; // "coding" | "standard"
}
```

### 2.2 Add provider imports

File: `packages/core/src/ai/sdk-client.ts`

Add at top:

```typescript
import { createZhipu } from "zhipu-ai-provider";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { GLM_ENDPOINT_INFO } from "@repo/schemas";
```

### 2.3 Update createLanguageModel function

Add new cases to the switch statement:

```typescript
function createLanguageModel(config: AIClientConfig): LanguageModel {
  switch (config.provider) {
    // ... existing cases for gemini, openai, anthropic ...

    case "glm": {
      const endpoint = config.glmEndpoint || "coding"; // Default to coding endpoint
      const baseURL = GLM_ENDPOINT_INFO[endpoint].url;

      const zhipu = createZhipu({
        apiKey: config.apiKey,
        baseURL,
      });

      return zhipu(config.model || "glm-4.7");
    }

    case "openrouter": {
      if (!config.model) {
        throw new Error("OpenRouter requires a model to be specified");
      }

      const openrouter = createOpenRouter({
        apiKey: config.apiKey,
      });

      return openrouter(config.model);
    }

    default:
      throw new Error(`Unsupported provider: ${config.provider}`);
  }
}
```

### 2.4 Update createAIClient factory

Ensure glmEndpoint is passed through:

```typescript
export function createAIClient(config: AIClientConfig): AIClient {
  const model = createLanguageModel({
    ...config,
    glmEndpoint: config.glmEndpoint,
  });

  // ... rest of implementation
}
```

### 2.5 Update error handling

File: `packages/core/src/ai/errors.ts`

Both providers use OpenAI-compatible error format. Verify existing error patterns work:

```typescript
// GLM and OpenRouter use similar error structures to OpenAI
// Existing error classification should work, but verify:
// - 401: API_KEY_INVALID
// - 429: RATE_LIMITED
// - 500+: PROVIDER_ERROR
```

### 2.6 Update server AI client initialization

File: `apps/server/src/lib/ai-client.ts`

Update `initializeAIClient()` to load and pass glmEndpoint:

```typescript
export async function initializeAIClient(): Promise<Result<AIClient, Error>> {
  const configResult = await configStore.read();
  if (!configResult.ok) {
    return err(new Error("No configuration found"));
  }

  const config = configResult.value;
  const apiKey = await getApiKey(config.provider);

  if (!apiKey) {
    return err(new Error(`No API key found for ${config.provider}`));
  }

  // OpenRouter requires model
  if (config.provider === "openrouter" && !config.model) {
    return err(new Error("OpenRouter requires a model to be configured"));
  }

  const client = createAIClient({
    apiKey,
    provider: config.provider,
    model: config.model,
    glmEndpoint: config.glmEndpoint, // Pass through for GLM
  });

  return ok(client);
}
```

## Notes

### GLM Coding Endpoint

The coding endpoint (`https://api.z.ai/api/coding/paas/v4`) is optimized for:
- Code review and analysis
- Programming-related tasks
- Better performance on SWE-bench

Default to coding endpoint since Stargazer is a code review tool.

### OpenRouter Model Requirement

OpenRouter supports 400+ models, so we can't have a sensible default. The model MUST be configured by the user before using OpenRouter.

### Thinking Mode

GLM-4.7 supports a "thinking" mode for step-by-step reasoning. The `zhipu-ai-provider` exposes this via options:

```typescript
// For future enhancement - not required for initial implementation
zhipu(model, { think: true })
```

## Validation

```bash
npm run type-check
```

Test that SDK client compiles. Full runtime testing in Phase 6.
