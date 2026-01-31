# Backend Requirements: Frontend-Backend Integration

## Context

Stargazer has **two frontends** (CLI + Web) that need unified backend integration for:
1. **Provider selection** - choosing AI provider (OpenAI, Anthropic, etc.)
2. **Theme persistence** - dark/light/auto/terminal themes
3. **Settings persistence** - user preferences across sessions
4. **Trust configuration** - per-project security settings

Both apps share `@repo/schemas` types and `@repo/api` client.

---

## CURRENT STATUS (Updated 2026-01-31)

### CLI Frontend - FULLY CONNECTED

All endpoints implemented in `use-settings-state.ts`:
- `activateProvider()` - DONE
- `deleteProviderCredentials()` - DONE
- `saveCredentials()` - DONE
- `saveTheme()` - DONE
- Provider caching with 5-min TTL - DONE

### Web Frontend - GAPS IDENTIFIED

**Gap 1: Theme is LOCAL-ONLY**
- `theme-provider.tsx` uses `localStorage` only
- NOT synced with backend `/settings` endpoint
- CLI and Web have different themes

**Gap 2: Missing API Methods**
- `activateProvider()` - MISSING
- `deleteProviderCredentials()` - MISSING
- `loadInit()` - MISSING

**Gap 3: No Provider Caching**
- CLI has 5-min cache
- Web fetches every time

---

## Current Integration Matrix

### CLI (apps/cli)

| Feature | Hook | API | Backend | Status |
|---------|------|-----|---------|--------|
| Load Settings | `loadAll()` | `loadSettings()` | `GET /settings` | **OK** |
| Save Theme | `saveTheme()` | `saveSettings()` | `POST /settings` | **OK** |
| Load Trust | `loadAll()` | `loadTrust()` | `GET /settings/trust` | **OK** |
| Save Trust | `saveTrust()` | `saveTrust()` | `POST /settings/trust` | **OK** |
| Check Config | `loadAll()` | `checkConfig()` | `GET /config/check` | **OK** |
| Save Config | `saveCredentials()` | `saveConfig()` | `POST /config` | **OK** |
| Delete Config | `deleteConfig()` | `deleteConfig()` | `DELETE /config` | **OK** |
| Provider Status | `loadAll()` | `loadProviderStatus()` | `GET /config/providers` | **OK** |
| OpenRouter Models | - | `fetchOpenRouterModels()` | `GET /config/openrouter/models` | **OK** |
| Init Combined | - | `loadInit()` | `GET /config/init` | **OK** |
| Activate Provider | `activateProvider()` | `activateProvider()` | `POST /config/provider/:id/activate` | **OK** |
| Delete Provider Key | `deleteProviderCredentials()` | `deleteProviderCredentials()` | `DELETE /config/provider/:id` | **OK** |

### Web (apps/web)

| Feature | Provider/Hook | API | Backend | Status |
|---------|---------------|-----|---------|--------|
| Load Config | `ConfigProvider` | `getConfig()` | `GET /config` | **OK** |
| Save Config | - | `saveConfig()` | `POST /config` | **OK** |
| Delete Config | - | `deleteConfig()` | `DELETE /config` | **OK** |
| Get Settings | - | `getSettings()` | `GET /settings` | **OK** |
| Save Settings | - | `saveSettings()` | `POST /settings` | **OK** |
| Provider Status | `ConfigProvider` | `getProviderStatus()` | `GET /config/providers` | **OK** |
| **Theme Sync** | `ThemeProvider` | **MISSING** | `POST /settings` | **LOCAL-ONLY** |
| **Activate Provider** | - | **MISSING** | `POST /config/provider/:id/activate` | **MISSING** |
| **Delete Provider Key** | - | **MISSING** | `DELETE /config/provider/:id` | **MISSING** |
| **Init Combined** | - | **MISSING** | `GET /config/init` | **MISSING** |

---

## Required Changes (Web App)

### 1. Add Missing API Methods to config-api.ts

**File**: `apps/web/src/features/settings/api/config-api.ts`

```typescript
// Add these methods:
export async function activateProvider(providerId: string, model?: string): Promise<{ provider: string; model?: string }> {
  return api.post(`/config/provider/${providerId}/activate`, { model });
}

export async function deleteProviderCredentials(providerId: string): Promise<{ deleted: boolean; provider: string }> {
  return api.delete(`/config/provider/${providerId}`);
}

export async function loadInit(): Promise<InitResponse> {
  return api.get('/config/init');
}
```

### 2. Sync ThemeProvider with Backend

**File**: `apps/web/src/app/providers/theme-provider.tsx`

Current: Uses localStorage only
Change: On theme change, also POST to /settings

```typescript
const setTheme = async (newTheme: WebTheme) => {
  setThemeState(newTheme);
  localStorage.setItem(STORAGE_KEY, newTheme);
  // NEW: Sync with backend
  await saveSettings({ theme: newTheme });
};
```

### 3. Load Theme from Backend on Init

**File**: `apps/web/src/app/providers/theme-provider.tsx`

```typescript
useEffect(() => {
  // Load from backend on mount
  getSettings().then(settings => {
    if (settings?.theme) {
      setThemeState(settings.theme);
      localStorage.setItem(STORAGE_KEY, settings.theme);
    }
  });
}, []);
```

### 4. Add Provider Caching to Web

**File**: `apps/web/src/app/providers/config-provider.tsx`

Port CLI's caching pattern (5-min TTL).

---

## Implementation Checklist

### CLI (Already Complete)
- [x] `activateProvider()` in settings-api.ts
- [x] `deleteProviderCredentials()` in settings-api.ts
- [x] Hook methods in use-settings-state.ts
- [x] Provider caching with 5-min TTL

### Web (TODO)
- [ ] Add `activateProvider()` to config-api.ts
- [ ] Add `deleteProviderCredentials()` to config-api.ts
- [ ] Add `loadInit()` to config-api.ts
- [ ] Sync ThemeProvider with backend
- [ ] Load theme from backend on init
- [ ] Add provider caching to ConfigProvider
- [ ] Update provider-selector page to use new APIs

---

## Unified Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│                        Backend                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ GET /config/init → { config, settings, providers }      ││
│  │ POST /settings → { theme, ... }                         ││
│  │ POST /config/provider/:id/activate → { provider, model }││
│  │ DELETE /config/provider/:id → { deleted, provider }     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                          ▲
                          │
          ┌───────────────┴───────────────┐
          │                               │
    ┌─────┴─────┐                   ┌─────┴─────┐
    │    CLI    │                   │    Web    │
    │  (React   │                   │  (React   │
    │   Ink)    │                   │   Vite)   │
    ├───────────┤                   ├───────────┤
    │useSettings│                   │ConfigProv │
    │State      │                   │ThemeProv  │
    │(unified)  │                   │(separate) │
    └───────────┘                   └───────────┘
```

---

## Questions Resolved

1. **Should theme sync between CLI and Web?** → YES, via /settings endpoint
2. **Should provider cache be shared?** → No, each app has its own cache
3. **Real-time sync needed?** → No, refresh on navigation is sufficient

---

## Discussion Log

- 2026-01-31: CLI integration verified complete
- 2026-01-31: Web gaps identified: theme local-only, missing API methods
- TODO: Implement Web changes
