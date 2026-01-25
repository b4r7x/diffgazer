# Phase 4: CLI UI

**Agent**: `frontend-developer`
**Validation**: `npm run type-check`
**Depends on**: Phase 1, Phase 2, Phase 3

## Overview

Update CLI UI to support GLM and OpenRouter provider selection with:
- GLM endpoint toggle (coding/standard)
- OpenRouter model search with free tier indicator
- Updated provider list with new options

## Files to Create/Modify

| File | Action | Changes |
|------|--------|---------|
| `apps/cli/src/components/wizard/provider-step.tsx` | MODIFY | Add GLM, OpenRouter |
| `apps/cli/src/components/wizard/openrouter-model-step.tsx` | CREATE | Model search UI |
| `apps/cli/src/components/wizard/glm-options-step.tsx` | CREATE | Endpoint selection |
| `apps/cli/src/components/wizard/model-step.tsx` | MODIFY | Route to new steps |
| `apps/cli/src/app/screens/onboarding-screen.tsx` | MODIFY | Update env vars |
| `apps/cli/src/app/screens/settings-screen.tsx` | MODIFY | Update env vars |
| `apps/cli/src/hooks/use-openrouter-models.ts` | CREATE | Model fetching hook |

## Tasks

### 4.1 Create OpenRouter models hook

File: `apps/cli/src/hooks/use-openrouter-models.ts`

```typescript
import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { OpenRouterModel } from "@repo/schemas";

interface UseOpenRouterModelsReturn {
  models: OpenRouterModel[];
  isLoading: boolean;
  error: string | null;
  search: string;
  setSearch: (query: string) => void;
  freeOnly: boolean;
  setFreeOnly: (value: boolean) => void;
  refresh: () => Promise<void>;
  filteredModels: OpenRouterModel[];
}

export function useOpenRouterModels(): UseOpenRouterModelsReturn {
  const [models, setModels] = useState<OpenRouterModel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [freeOnly, setFreeOnly] = useState(false);

  const fetchModels = useCallback(async (forceRefresh = false) => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (forceRefresh) params.set("refresh", "true");

      const response = await api().get(`/config/openrouter/models?${params}`);
      const data = await response.json();

      if (data.error) {
        setError(data.error);
      } else {
        setModels(data.models);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to fetch models");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  const refresh = useCallback(() => fetchModels(true), [fetchModels]);

  // Client-side filtering for responsiveness
  const filteredModels = models.filter((m) => {
    if (freeOnly && !m.isFree) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.description?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return {
    models,
    isLoading,
    error,
    search,
    setSearch,
    freeOnly,
    setFreeOnly,
    refresh,
    filteredModels,
  };
}
```

### 4.2 Create OpenRouter model selection component

File: `apps/cli/src/components/wizard/openrouter-model-step.tsx`

```typescript
import React, { useState } from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";
import { SelectList } from "@/components/ui/select-list";
import { Badge } from "@/components/ui/badge";
import { useOpenRouterModels } from "@/hooks/use-openrouter-models";
import type { OpenRouterModel } from "@repo/schemas";

interface Props {
  onSelect: (modelId: string) => void;
  onBack: () => void;
}

export function OpenRouterModelStep({ onSelect, onBack }: Props) {
  const {
    filteredModels,
    isLoading,
    error,
    search,
    setSearch,
    freeOnly,
    setFreeOnly,
    refresh,
  } = useOpenRouterModels();

  const [focusSearch, setFocusSearch] = useState(true);

  if (isLoading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Loading OpenRouter models...</Text>
        <Text dimColor>(This may take a moment on first load)</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error}</Text>
        <Text dimColor>Press r to retry, Escape to go back</Text>
      </Box>
    );
  }

  const items = filteredModels.slice(0, 50).map((m) => ({
    label: formatModelLabel(m),
    value: m.id,
    description: m.description || `Context: ${m.contextLength.toLocaleString()} tokens`,
  }));

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>Select OpenRouter Model</Text>
      <Text dimColor>
        {filteredModels.length} models{freeOnly ? " (free only)" : ""}
      </Text>

      <Box marginY={1}>
        <Text>Search: </Text>
        <TextInput
          value={search}
          onChange={setSearch}
          placeholder="Type to filter..."
          focus={focusSearch}
        />
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>
          [Tab] Toggle search • [f] Free only: {freeOnly ? "ON" : "OFF"} • [r] Refresh
        </Text>
      </Box>

      {items.length === 0 ? (
        <Text dimColor>No models match your search</Text>
      ) : (
        <SelectList
          items={items}
          onSelect={(item) => onSelect(item.value)}
          onBack={onBack}
          maxVisible={10}
        />
      )}

      {filteredModels.length > 50 && (
        <Text dimColor italic>
          Showing first 50 of {filteredModels.length} results. Refine your search.
        </Text>
      )}
    </Box>
  );
}

function formatModelLabel(m: OpenRouterModel): string {
  const parts = [m.name];
  if (m.isFree) {
    parts.push("🆓");
  }
  return parts.join(" ");
}
```

### 4.3 Create GLM options component

File: `apps/cli/src/components/wizard/glm-options-step.tsx`

```typescript
import React from "react";
import { Box, Text } from "ink";
import { SelectList } from "@/components/ui/select-list";
import { GLM_ENDPOINT_INFO, GLM_MODEL_INFO, type GLMEndpoint, type GLMModel } from "@repo/schemas";

interface Props {
  onSelect: (options: { model: GLMModel; endpoint: GLMEndpoint }) => void;
  onBack: () => void;
  currentModel?: GLMModel;
  currentEndpoint?: GLMEndpoint;
}

type Step = "endpoint" | "model";

export function GLMOptionsStep({ onSelect, onBack, currentModel, currentEndpoint }: Props) {
  const [step, setStep] = React.useState<Step>("endpoint");
  const [endpoint, setEndpoint] = React.useState<GLMEndpoint>(currentEndpoint || "coding");

  if (step === "endpoint") {
    const items = (Object.entries(GLM_ENDPOINT_INFO) as [GLMEndpoint, typeof GLM_ENDPOINT_INFO["coding"]][]).map(
      ([id, info]) => ({
        label: id === "coding" ? `${info.name} (Recommended)` : info.name,
        value: id,
        description: info.description,
      })
    );

    return (
      <Box flexDirection="column" padding={1}>
        <Text bold>GLM Endpoint</Text>
        <Text dimColor>Select the API endpoint for GLM</Text>

        <Box marginY={1}>
          <SelectList
            items={items}
            onSelect={(item) => {
              setEndpoint(item.value as GLMEndpoint);
              setStep("model");
            }}
            onBack={onBack}
            defaultValue={endpoint}
          />
        </Box>

        <Box marginTop={1}>
          <Text dimColor italic>
            The Coding endpoint is optimized for code review and programming tasks.
          </Text>
        </Box>
      </Box>
    );
  }

  // Model selection step
  const items = (Object.entries(GLM_MODEL_INFO) as [GLMModel, typeof GLM_MODEL_INFO["glm-4.7"]][]).map(
    ([id, info]) => ({
      label: info.recommended ? `${info.name} (Recommended)` : info.name,
      value: id,
      description: info.description,
    })
  );

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold>GLM Model</Text>
      <Text dimColor>Endpoint: {GLM_ENDPOINT_INFO[endpoint].name}</Text>

      <Box marginY={1}>
        <SelectList
          items={items}
          onSelect={(item) => {
            onSelect({
              model: item.value as GLMModel,
              endpoint,
            });
          }}
          onBack={() => setStep("endpoint")}
          defaultValue={currentModel || "glm-4.7"}
        />
      </Box>
    </Box>
  );
}
```

### 4.4 Update provider step

File: `apps/cli/src/components/wizard/provider-step.tsx`

Update to include GLM and OpenRouter:

```typescript
// In the items array, add:
{
  label: "GLM (Z.ai)",
  value: "glm",
  description: "Chinese LLM with dedicated coding endpoint",
  badge: providerStatus?.glm?.hasApiKey ? "Configured" : undefined,
},
{
  label: "OpenRouter",
  value: "openrouter",
  description: "Gateway to 400+ AI models",
  badge: providerStatus?.openrouter?.hasApiKey ? "Configured" : undefined,
},
```

### 4.5 Update model step routing

File: `apps/cli/src/components/wizard/model-step.tsx`

Add routing for new providers:

```typescript
import { GLMOptionsStep } from "./glm-options-step";
import { OpenRouterModelStep } from "./openrouter-model-step";

// In the component:
if (provider === "openrouter") {
  return (
    <OpenRouterModelStep
      onSelect={(modelId) => onSelect({ model: modelId })}
      onBack={onBack}
    />
  );
}

if (provider === "glm") {
  return (
    <GLMOptionsStep
      onSelect={({ model, endpoint }) => onSelect({ model, glmEndpoint: endpoint })}
      onBack={onBack}
      currentModel={currentModel as GLMModel}
      currentEndpoint={currentEndpoint}
    />
  );
}

// Existing static model list for other providers...
```

### 4.6 Update env var detection

File: `apps/cli/src/app/screens/onboarding-screen.tsx`

```typescript
const PROVIDER_ENV_VARS: Record<AIProvider, string[]> = {
  gemini: ["GEMINI_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
  glm: ["GLM_API_KEY", "ZHIPU_API_KEY"],
  openrouter: ["OPENROUTER_API_KEY"],
};

// Update detection logic to check multiple vars:
function getEnvApiKey(provider: AIProvider): string | undefined {
  const vars = PROVIDER_ENV_VARS[provider] || [];
  for (const v of vars) {
    if (process.env[v]) return process.env[v];
  }
  return undefined;
}
```

File: `apps/cli/src/app/screens/settings-screen.tsx`

Same update as above.

### 4.7 Export hooks

File: `apps/cli/src/hooks/index.ts`

```typescript
export { useOpenRouterModels } from "./use-openrouter-models";
```

### 4.8 Update components index

File: `apps/cli/src/components/wizard/index.ts`

```typescript
export { GLMOptionsStep } from "./glm-options-step";
export { OpenRouterModelStep } from "./openrouter-model-step";
```

## UI/UX Notes

### OpenRouter Model List

- Show first 50 results to prevent UI slowdown
- Client-side filtering for instant response
- "🆓" emoji for free models
- Search by id, name, or description
- Free-only toggle with [f] key

### GLM Endpoint Selection

- Default to "coding" endpoint (optimized for code review)
- Two-step flow: endpoint → model
- Clear explanation of why coding endpoint is recommended

### Keyboard Navigation

- Tab: Toggle between search and list
- f: Toggle free-only filter
- r: Refresh model cache
- Escape: Go back

## Validation

```bash
npm run type-check
```

Manual test:
1. Run `stargazer`
2. Go to Settings → Provider
3. Select GLM → verify endpoint/model flow
4. Select OpenRouter → verify model search
