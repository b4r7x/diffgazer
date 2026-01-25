# Phase 6: Settings Feature Refactor

## Problem

Settings logic is scattered across 4 locations:
1. `app/screens/settings-screen.tsx` - presentation
2. `components/wizard/` - wizard steps (shared, OK)
3. `hooks/use-settings.ts` - local settings
4. `hooks/use-config.ts` - provider/API key

Per Bulletproof React, this should be a unified feature module.

---

## Target Structure

```
features/settings/
├── api/
│   ├── index.ts
│   └── settings-api.ts         # Unified API client
├── components/
│   ├── index.ts
│   └── settings-sections/      # Section-specific UI
│       ├── trust-section.tsx
│       ├── theme-section.tsx
│       ├── provider-section.tsx
│       ├── credentials-section.tsx
│       ├── controls-section.tsx
│       └── diagnostics-section.tsx
├── hooks/
│   ├── index.ts
│   ├── use-settings-state.ts   # Unified state
│   └── use-settings-state.test.ts
├── constants.ts
├── types.ts
└── index.ts
```

Note: `settings-screen.tsx` stays in `app/screens/` as it's orchestration layer.

---

## Task 6.1: Create settings-api.ts

**File:** `apps/cli/src/features/settings/api/settings-api.ts`

Unified API client that combines all settings-related calls:

```typescript
import { api } from "@/lib/api";
import type {
  SettingsConfig,
  TrustConfig,
  ProvidersStatusResponse,
  AIProvider,
} from "@repo/schemas";

export const settingsApi = {
  // Settings (theme, controls, etc.)
  loadSettings: () =>
    api().get<{ settings: SettingsConfig }>("/settings"),

  saveSettings: (settings: SettingsConfig) =>
    api().post<{ settings: SettingsConfig }>("/settings", settings),

  // Trust
  loadTrust: (projectId: string) =>
    api().get<{ trust: TrustConfig | null }>(`/settings/trust?projectId=${projectId}`),

  saveTrust: (config: TrustConfig) =>
    api().post<{ trust: TrustConfig }>("/settings/trust", config),

  removeTrust: (projectId: string) =>
    api().delete<{ removed: boolean }>(`/settings/trust?projectId=${projectId}`),

  listTrustedProjects: () =>
    api().get<{ projects: TrustConfig[] }>("/settings/trust/list"),

  // Provider/Config
  checkConfig: () =>
    api().get<{ configured: boolean; config?: { provider: string; model?: string } }>("/config/check"),

  loadConfig: () =>
    api().get<{ provider: string; model?: string }>("/config"),

  saveConfig: (provider: AIProvider, apiKey: string, model?: string) =>
    api().post<{ provider: string; model?: string }>("/config", { provider, apiKey, model }),

  deleteConfig: () =>
    api().delete<{ deleted: boolean }>("/config"),

  loadProviderStatus: () =>
    api().get<ProvidersStatusResponse>("/config/providers"),

  // Diagnostics
  testConnection: (provider: AIProvider) =>
    api().post<{ success: boolean; message?: string }>("/config/test", { provider }),
};
```

---

## Task 6.2: Create use-settings-state.ts

**File:** `apps/cli/src/features/settings/hooks/use-settings-state.ts`

Unified state hook that combines config + settings + trust + providers:

```typescript
import { useState, useCallback } from "react";
import { settingsApi } from "../api/settings-api";
import type {
  SettingsConfig,
  TrustConfig,
  ProviderStatus,
  AIProvider,
  Theme,
  ControlsMode,
  TrustCapabilities,
} from "@repo/schemas";

interface SettingsState {
  // Loading states
  isLoading: boolean;
  isSaving: boolean;

  // Data
  settings: SettingsConfig | null;
  trust: TrustConfig | null;
  config: { provider: string; model?: string } | null;
  providerStatus: ProviderStatus[];
  isConfigured: boolean;

  // Errors
  error: { message: string } | null;
}

export function useSettingsState(projectId: string, repoRoot: string) {
  const [state, setState] = useState<SettingsState>({
    isLoading: false,
    isSaving: false,
    settings: null,
    trust: null,
    config: null,
    providerStatus: [],
    isConfigured: false,
    error: null,
  });

  // Load all settings data
  const loadAll = useCallback(async () => {
    setState(s => ({ ...s, isLoading: true, error: null }));

    try {
      const [settingsRes, trustRes, configRes, providerRes] = await Promise.all([
        settingsApi.loadSettings(),
        settingsApi.loadTrust(projectId),
        settingsApi.checkConfig(),
        settingsApi.loadProviderStatus(),
      ]);

      setState(s => ({
        ...s,
        isLoading: false,
        settings: settingsRes.settings,
        trust: trustRes.trust,
        config: configRes.config ?? null,
        providerStatus: providerRes.providers,
        isConfigured: configRes.configured,
      }));
    } catch (err) {
      setState(s => ({
        ...s,
        isLoading: false,
        error: { message: err instanceof Error ? err.message : "Failed to load settings" },
      }));
    }
  }, [projectId]);

  // Save theme
  const saveTheme = useCallback(async (theme: Theme) => {
    const current = state.settings ?? DEFAULT_SETTINGS;
    const updated = { ...current, theme };

    setState(s => ({ ...s, isSaving: true }));
    try {
      await settingsApi.saveSettings(updated);
      setState(s => ({ ...s, settings: updated, isSaving: false }));
    } catch (err) {
      setState(s => ({ ...s, isSaving: false, error: { message: "Failed to save theme" } }));
    }
  }, [state.settings]);

  // Save controls mode
  const saveControlsMode = useCallback(async (controlsMode: ControlsMode) => {
    const current = state.settings ?? DEFAULT_SETTINGS;
    const updated = { ...current, controlsMode };

    setState(s => ({ ...s, isSaving: true }));
    try {
      await settingsApi.saveSettings(updated);
      setState(s => ({ ...s, settings: updated, isSaving: false }));
    } catch (err) {
      setState(s => ({ ...s, isSaving: false, error: { message: "Failed to save controls" } }));
    }
  }, [state.settings]);

  // Save trust
  const saveTrust = useCallback(async (capabilities: TrustCapabilities, mode: "persistent" | "session") => {
    const trustConfig: TrustConfig = {
      projectId,
      repoRoot,
      trustedAt: new Date().toISOString(),
      capabilities,
      trustMode: mode,
    };

    setState(s => ({ ...s, isSaving: true }));
    try {
      await settingsApi.saveTrust(trustConfig);
      setState(s => ({ ...s, trust: trustConfig, isSaving: false }));
    } catch (err) {
      setState(s => ({ ...s, isSaving: false, error: { message: "Failed to save trust" } }));
    }
  }, [projectId, repoRoot]);

  // Save provider credentials
  const saveCredentials = useCallback(async (provider: AIProvider, apiKey: string, model?: string) => {
    setState(s => ({ ...s, isSaving: true }));
    try {
      await settingsApi.saveConfig(provider, apiKey, model);
      // Reload provider status to reflect changes
      const providerRes = await settingsApi.loadProviderStatus();
      setState(s => ({
        ...s,
        config: { provider, model },
        providerStatus: providerRes.providers,
        isConfigured: true,
        isSaving: false,
      }));
    } catch (err) {
      setState(s => ({ ...s, isSaving: false, error: { message: "Failed to save credentials" } }));
    }
  }, []);

  // Delete config
  const deleteConfig = useCallback(async () => {
    setState(s => ({ ...s, isSaving: true }));
    try {
      await settingsApi.deleteConfig();
      const providerRes = await settingsApi.loadProviderStatus();
      setState(s => ({
        ...s,
        config: null,
        providerStatus: providerRes.providers,
        isConfigured: false,
        isSaving: false,
      }));
    } catch (err) {
      setState(s => ({ ...s, isSaving: false, error: { message: "Failed to delete config" } }));
    }
  }, []);

  return {
    // State
    ...state,

    // Computed
    isTrusted: !!state.trust,
    activeProvider: state.config?.provider,

    // Actions
    loadAll,
    saveTheme,
    saveControlsMode,
    saveTrust,
    saveCredentials,
    deleteConfig,
  };
}

const DEFAULT_SETTINGS: SettingsConfig = {
  theme: "auto",
  controlsMode: "menu",
  defaultLenses: ["correctness"],
  defaultProfile: null,
  severityThreshold: "medium",
};
```

---

## Task 6.3: Create Feature Index

**File:** `apps/cli/src/features/settings/index.ts`

```typescript
// API
export { settingsApi } from "./api/settings-api";

// Hooks
export { useSettingsState } from "./hooks/use-settings-state";

// Types (re-export from schemas)
export type {
  SettingsConfig,
  TrustConfig,
  Theme,
  ControlsMode,
  TrustCapabilities,
} from "@repo/schemas/settings";
```

---

## Task 6.4: Update App to Use Unified Hook

**File:** `apps/cli/src/app/app.tsx`

Replace separate hooks with unified state:
```typescript
// Before:
const localSettings = useSettings();
const config = useConfig();
// ... spread across multiple places

// After:
import { useSettingsState } from "@/features/settings";

const settingsState = useSettingsState(projectId, repoRoot);

// Use in settings view:
<SettingsView
  settings={settingsState.settings}
  configuredProviders={settingsState.providerStatus}
  isTrusted={settingsState.isTrusted}
  // ... etc
/>
```

---

## Task 6.5: Move Section Components

Move section-specific components from wizard to settings feature:

**Keep in components/wizard/** (shared between onboarding and settings):
- wizard-frame.tsx
- trust-step.tsx
- theme-step.tsx
- provider-step.tsx
- credentials-step.tsx
- controls-step.tsx
- summary-step.tsx

**Create in features/settings/components/** (settings-specific wrappers):
- trust-section.tsx (wraps TrustStep with settings-specific logic)
- diagnostics-section.tsx (settings-only, not in wizard)

---

## Task 6.6: Deprecate Old Hooks

Mark old hooks for removal:
```typescript
// hooks/use-settings.ts
/** @deprecated Use useSettingsState from features/settings instead */
export function useSettings() {
  // ... existing implementation
}

// hooks/use-config.ts
/** @deprecated Use useSettingsState from features/settings instead */
export function useConfig() {
  // ... existing implementation
}
```

Then gradually migrate usages and remove.

---

## Validation

1. All settings operations work through unified hook
2. Theme changes persist immediately
3. Provider status shows correctly in settings
4. Trust changes persist
5. No import cycles between features
