# Phase 1: API Layer - Provider Status

## Problem

Settings screen shows all providers as "[Not Configured]" because:
1. `configuredProviders` prop defaults to empty array
2. No API endpoint to get provider configuration status
3. Server has keyring info but doesn't expose it to CLI

## Solution

Add `/config/providers` endpoint that returns configuration status for all providers.

---

## Task 1.1: Add ProvidersStatusResponse Schema

**File:** `packages/schemas/src/config.ts`

Add:
```typescript
export const ProviderStatusSchema = z.object({
  provider: AIProviderSchema,
  hasApiKey: z.boolean(),
  model: z.string().optional(),
  isActive: z.boolean(), // currently selected provider
});

export const ProvidersStatusResponseSchema = z.object({
  providers: z.array(ProviderStatusSchema),
  activeProvider: AIProviderSchema.optional(),
});

export type ProviderStatus = z.infer<typeof ProviderStatusSchema>;
export type ProvidersStatusResponse = z.infer<typeof ProvidersStatusResponseSchema>;
```

---

## Task 1.2: Add /config/providers Endpoint

**File:** `apps/server/src/api/routes/config.ts`

Add new route:
```typescript
config.get("/providers", async (c) => {
  const configResult = await configStore.read();
  const activeProvider = configResult.ok ? configResult.value.provider : undefined;
  const activeModel = configResult.ok ? configResult.value.model : undefined;

  const providers: ProviderStatus[] = await Promise.all(
    AVAILABLE_PROVIDERS.map(async (p) => {
      const keyResult = await getApiKey(p.id);
      const hasApiKey = keyResult.ok && !!keyResult.value;
      const isActive = p.id === activeProvider;

      return {
        provider: p.id,
        hasApiKey,
        model: isActive ? activeModel : undefined,
        isActive,
      };
    })
  );

  return jsonOk(c, {
    providers,
    activeProvider
  });
});
```

---

## Task 1.3: Add loadProviderStatus to useConfig

**File:** `apps/cli/src/hooks/use-config.ts`

Add:
```typescript
import type { ProvidersStatusResponse, ProviderStatus } from "@repo/schemas/config";

// In useConfig hook:
const providerStatusOp = useAsyncOperation<ProvidersStatusResponse>();

async function loadProviderStatus() {
  return await providerStatusOp.execute(async () => {
    return await api().get<ProvidersStatusResponse>("/config/providers");
  });
}

// Return:
return {
  // ... existing
  providerStatus: providerStatusOp.state.data ?? null,
  loadProviderStatus,
};
```

---

## Task 1.4: Update SettingsScreenProps Interface

**File:** `apps/cli/src/app/screens/settings-screen.tsx`

The `configuredProviders` prop type should match ProviderStatus[]:
```typescript
interface SettingsScreenProps {
  // ... existing
  configuredProviders?: ProviderStatus[]; // Already uses ProviderConfig which is similar
}
```

Ensure `ProviderConfig` interface matches:
```typescript
interface ProviderConfig {
  provider: AIProvider;
  model?: string;
  hasApiKey: boolean;
}
```

This already matches the server response structure.

---

## Validation

```bash
npm run type-check
npm run build
```

Test:
1. Start server
2. Call GET /config/providers
3. Should return status for all providers with hasApiKey based on keyring
