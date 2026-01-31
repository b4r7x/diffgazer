# Implementation Workflow: Frontend-Backend Integration

## Overview

CLI is complete. This workflow focuses on **Web app** integration.

**Status**:
- CLI: COMPLETE (all endpoints connected)
- Web: NEEDS WORK (theme local-only, missing API methods)

---

## Phase 1: Web API Layer (Parallel)

### Agent 1A: Add activateProvider to Web API
**Target**: `apps/web/src/features/settings/api/config-api.ts`
**Task**: Add `activateProvider(providerId, model?)` method

### Agent 1B: Add deleteProviderCredentials to Web API
**Target**: `apps/web/src/features/settings/api/config-api.ts`
**Task**: Add `deleteProviderCredentials(providerId)` method

### Agent 1C: Add loadInit to Web API
**Target**: `apps/web/src/features/settings/api/config-api.ts`
**Task**: Add `loadInit()` method for startup optimization

---

## Phase 2: Theme Sync (Depends on Phase 1)

### Agent 2A: Sync ThemeProvider with Backend
**Target**: `apps/web/src/app/providers/theme-provider.tsx`
**Task**:
1. On init, load theme from `GET /settings`
2. On change, save to `POST /settings` + localStorage

---

## Phase 3: ConfigProvider Enhancement (Parallel with Phase 2)

### Agent 3A: Add Provider Caching
**Target**: `apps/web/src/app/providers/config-provider.tsx`
**Task**: Add 5-minute TTL cache (mirror CLI pattern)

### Agent 3B: Use loadInit for Startup
**Target**: `apps/web/src/app/providers/config-provider.tsx`
**Task**: Replace separate fetches with single `/config/init` call

---

## Phase 4: Provider Selector Updates

### Agent 4A: Connect Provider Actions
**Target**: `apps/web/src/app/pages/provider-selector.tsx` (or equivalent)
**Task**:
1. Use `activateProvider()` for switching
2. Use `deleteProviderCredentials()` for key removal

---

## Execution Order

```
Phase 1 (Parallel):
  ├── Agent 1A: API activateProvider
  ├── Agent 1B: API deleteProviderCredentials
  └── Agent 1C: API loadInit

Phase 2 + 3 (Parallel, after Phase 1):
  ├── Agent 2A: Theme sync
  ├── Agent 3A: Provider caching
  └── Agent 3B: Use loadInit

Phase 4 (after Phase 2+3):
  └── Agent 4A: Provider selector UI

Phase 5 (Sequential):
  └── Verification: Type-check + Build + Test
```

---

## Implementation Specs

### 1A-C: config-api.ts additions

```typescript
// Add to apps/web/src/features/settings/api/config-api.ts

import type { InitResponse, CurrentConfigResponse, DeleteProviderCredentialsResponse } from '@repo/schemas';

export async function activateProvider(
  providerId: string,
  model?: string
): Promise<CurrentConfigResponse> {
  return api.post(`/config/provider/${providerId}/activate`, { model });
}

export async function deleteProviderCredentials(
  providerId: string
): Promise<DeleteProviderCredentialsResponse> {
  return api.delete(`/config/provider/${providerId}`);
}

export async function loadInit(): Promise<InitResponse> {
  return api.get('/config/init');
}
```

### 2A: theme-provider.tsx - Backend Sync

```typescript
// Add import
import { getSettings, saveSettings } from '@/features/settings/api/config-api';

// Modify ThemeProvider:
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<WebTheme>('auto');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from backend on mount
  useEffect(() => {
    getSettings()
      .then(settings => {
        if (settings?.theme) {
          const webTheme = settings.theme === 'terminal' ? 'dark' : settings.theme;
          setThemeState(webTheme);
          localStorage.setItem(STORAGE_KEY, webTheme);
        }
      })
      .catch(() => {
        // Fallback to localStorage
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === 'dark' || stored === 'light' || stored === 'auto') {
          setThemeState(stored);
        }
      })
      .finally(() => setIsLoaded(true));
  }, []);

  const setTheme = async (newTheme: WebTheme) => {
    setThemeState(newTheme);
    localStorage.setItem(STORAGE_KEY, newTheme);
    // Sync with backend (fire and forget)
    saveSettings({ theme: newTheme }).catch(console.error);
  };

  // ...rest unchanged
}
```

### 3A-B: config-provider.tsx - Caching + loadInit

```typescript
// Add caching
const CACHE_TTL = 5 * 60 * 1000;
let providerCache: { data: ProviderStatus[]; timestamp: number } | null = null;

function getCachedProviders(): ProviderStatus[] | null {
  if (!providerCache) return null;
  if (Date.now() - providerCache.timestamp > CACHE_TTL) {
    providerCache = null;
    return null;
  }
  return providerCache.data;
}

// Use loadInit in refresh
const refresh = useCallback(async () => {
  setIsLoading(true);
  setError(null);
  try {
    const cached = getCachedProviders();
    if (cached) {
      // Use cache for providers, still fetch config
      const configData = await getConfig().catch(() => null);
      if (configData) {
        setProvider(configData.provider);
        setModel(configData.model);
      }
      setIsConfigured(cached.some(p => p.isActive));
    } else {
      // Full init
      const initData = await loadInit();
      if (initData.config) {
        setProvider(initData.config.provider);
        setModel(initData.config.model);
      }
      setIsConfigured(initData.configured);
      providerCache = { data: initData.providers, timestamp: Date.now() };
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : "Failed to load configuration");
  } finally {
    setIsLoading(false);
  }
}, []);
```

---

## Verification Steps

1. **Type Check**: `npm run type-check`
2. **Build**: `npm run build`
3. **Test**: `npx vitest run`
4. **Manual Tests**:
   - Change theme in Web → reload CLI → theme should match
   - Change theme in CLI → reload Web → theme should match
   - Switch provider in Web → verify activation works
   - Remove key in Web → verify removal works

---

## Agent Assignment

| Task | Agent Type | Priority |
|------|------------|----------|
| 1A-C API methods | typescript-pro | High |
| 2A Theme sync | react-dev | High |
| 3A-B Config provider | typescript-pro | Medium |
| 4A Provider selector | react-dev | Medium |
| Verification | tdd-orchestrator | High |

---

## Files to Modify (Web only)

- `apps/web/src/features/settings/api/config-api.ts` - Add 3 methods
- `apps/web/src/app/providers/theme-provider.tsx` - Add backend sync
- `apps/web/src/app/providers/config-provider.tsx` - Add caching + loadInit
- `apps/web/src/app/pages/provider-selector.tsx` - Connect new APIs
