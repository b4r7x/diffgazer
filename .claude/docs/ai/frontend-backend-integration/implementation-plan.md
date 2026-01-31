# Implementation Plan: Frontend-Backend Integration Improvements

## Overview

Based on analysis, the integration is mostly complete. This plan focuses on three improvements:

1. **R1**: Model selection UX when switching providers
2. **R2**: Single startup endpoint for faster load
3. **R3**: Client-side caching for provider status

---

## Phase 1: Add `/config/init` Endpoint (Backend)

**Goal**: Single endpoint returning all startup data

### Task 1.1: Create Init Endpoint

**File**: `apps/server/src/api/routes/config.ts`

**Add endpoint**:
```typescript
config.get("/init", async (c) => {
  // Load in parallel
  const [configResult, settingsResult, providersResult] = await Promise.all([
    configStore.read(),
    settingsStore.read(),
    loadAllProviderStatus(),
  ]);

  return c.json({
    config: configResult.ok ? {
      provider: configResult.value.provider,
      model: configResult.value.model,
    } : null,
    settings: settingsResult.ok ? settingsResult.value : defaultSettings,
    providers: providersResult,
    configured: configResult.ok && hasApiKey(configResult.value.provider),
  });
});
```

**Schema** (add to `packages/schemas/src/config.ts`):
```typescript
export const InitResponseSchema = z.object({
  config: z.object({
    provider: AIProviderSchema,
    model: z.string().optional(),
  }).nullable(),
  settings: SettingsConfigSchema,
  providers: z.array(ProviderStatusSchema),
  configured: z.boolean(),
});
```

### Task 1.2: Update CLI to Use Init Endpoint

**File**: `apps/cli/src/features/settings/api/settings-api.ts`

**Add**:
```typescript
async loadInit(): Promise<InitResponse> {
  return await api().get<InitResponse>("/config/init");
}
```

**File**: `apps/cli/src/app/app.tsx`

**Change**: Replace separate `loadSettings()` and `loadProviderStatus()` with single `loadInit()`.

---

## Phase 2: Model Selection UX (Frontend)

**Goal**: When activating provider, show model picker if no model set

### Task 2.1: Update SettingsProvidersView

**File**: `apps/cli/src/app/views/settings-providers-view.tsx`

**Current flow**:
```
"Select as Active" → activateProvider(providerId) → done
```

**New flow**:
```
"Select as Active" →
  if (provider has model) → activateProvider(providerId) → done
  else → show ModelPicker → activateProvider(providerId, selectedModel) → done
```

### Task 2.2: Extract ModelPicker Component

**Create**: `apps/cli/src/components/model-picker.tsx`

Reuse logic from `apps/cli/src/components/wizard/model-step.tsx`:
- Get models for provider
- Show selection list
- Return selected model

---

## Phase 3: Client-Side Caching (Frontend)

**Goal**: Cache provider status with 5-minute TTL

### Task 3.1: Add Cache to Settings State

**File**: `apps/cli/src/features/settings/hooks/use-settings-state.ts`

**Add simple cache**:
```typescript
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const providerStatusCache: CacheEntry<ProviderStatus[]> | null = null;

function getCachedProviders(): ProviderStatus[] | null {
  if (!providerStatusCache) return null;
  if (Date.now() - providerStatusCache.timestamp > CACHE_TTL) return null;
  return providerStatusCache.data;
}
```

### Task 3.2: Invalidate Cache on Changes

When provider is activated/configured, clear cache:
```typescript
function invalidateProviderCache() {
  providerStatusCache = null;
}
```

---

## Execution Order

```
Phase 1 (Backend) → Phase 2 (Frontend) → Phase 3 (Frontend)
```

Phases 2 and 3 can run in parallel after Phase 1 completes.

---

## Agent Assignment

| Task | Agent Type | Priority |
|------|------------|----------|
| 1.1 Init Endpoint | backend-architect | High |
| 1.2 CLI Integration | typescript-pro | High |
| 2.1 Provider View | typescript-pro | Medium |
| 2.2 Model Picker | react-dev | Medium |
| 3.1 Cache Logic | typescript-pro | Low |
| 3.2 Cache Invalidation | typescript-pro | Low |

---

## Validation Checklist

- [ ] `/config/init` returns all startup data
- [ ] CLI loads theme before first render
- [ ] Switching providers shows model picker
- [ ] Provider status is cached
- [ ] Cache invalidates on config changes
- [ ] All existing tests pass
- [ ] No regression in onboarding flow

---

## Files to Modify

**Backend**:
- `apps/server/src/api/routes/config.ts` - Add init endpoint
- `packages/schemas/src/config.ts` - Add InitResponse schema

**Frontend**:
- `apps/cli/src/features/settings/api/settings-api.ts` - Add loadInit
- `apps/cli/src/app/app.tsx` - Use loadInit
- `apps/cli/src/app/views/settings-providers-view.tsx` - Model selection UX
- `apps/cli/src/components/model-picker.tsx` - New component
- `apps/cli/src/features/settings/hooks/use-settings-state.ts` - Caching
