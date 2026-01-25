# Phase 2: Wire SettingsView Props

## Problem

In `app.tsx`, SettingsView receives only partial props:
```tsx
<SettingsView
  provider={state.config.currentConfig?.provider ?? "Unknown"}
  model={state.config.currentConfig?.model}
  settingsState={state.config.settingsState}
  deleteState={state.config.deleteState}
  error={state.config.error}
  // MISSING: settings, configuredProviders, all save handlers, projectId, etc.
  onDelete={handlers.config.onDelete}
  onBack={handlers.config.onBack}
/>
```

This causes:
- Theme changes don't save (onSaveTheme is undefined)
- Provider shows "[Not Configured]" (configuredProviders is empty)
- No trust/controls handlers

---

## Task 2.1: Load Provider Status on Settings View

**File:** `apps/cli/src/app/app.tsx`

Add effect to load provider status when entering settings:
```typescript
useEffect(() => {
  if (view === "settings") {
    state.config.loadProviderStatus();
  }
}, [view]);
```

---

## Task 2.2: Add Settings Handlers to useScreenHandlers

**File:** `apps/cli/src/features/app/hooks/use-screen-handlers.ts`

Add settings handlers:
```typescript
interface ScreenHandlerConfig {
  // ... existing
  settings: {
    saveSettings: (config: SettingsConfig) => Promise<Result<void, StoreError>>;
    saveConfig: (provider: AIProvider, apiKey: string, model?: string) => Promise<void>;
  };
  trust: {
    saveTrust: (config: TrustConfig) => Promise<Result<void, StoreError>>;
  };
}

// In handler creation:
const settings = {
  onSaveTheme: async (theme: Theme) => {
    const current = localSettings.settings ?? DEFAULT_SETTINGS;
    await config.settings.saveSettings({ ...current, theme });
  },
  onSaveControls: async (controlsMode: ControlsMode) => {
    const current = localSettings.settings ?? DEFAULT_SETTINGS;
    await config.settings.saveSettings({ ...current, controlsMode });
  },
  onSaveTrust: async (capabilities: TrustCapabilities) => {
    await config.trust.saveTrust({
      projectId,
      repoRoot,
      trustedAt: new Date().toISOString(),
      capabilities,
      trustMode: "persistent",
    });
  },
  onSelectProvider: (provider: AIProvider) => {
    // Store selected provider for credentials step
    setSelectedProvider(provider);
  },
  onSaveCredentials: async (apiKey: string) => {
    await config.settings.saveConfig(selectedProvider, apiKey);
  },
};
```

---

## Task 2.3: Wire All Props in app.tsx

**File:** `apps/cli/src/app/app.tsx`

```typescript
{view === "settings" && (
  <SettingsView
    // Config data
    provider={state.config.currentConfig?.provider ?? "Unknown"}
    model={state.config.currentConfig?.model}
    settingsState={state.config.settingsState}
    deleteState={state.config.deleteState}
    error={state.config.error}

    // Local settings
    settings={localSettings.settings}

    // Provider status (from new endpoint)
    configuredProviders={state.config.providerStatus?.providers ?? []}

    // Project context
    projectId={projectId}
    repoRoot={repoRoot}
    currentCapabilities={trustState.capabilities}

    // All handlers
    onDelete={handlers.config.onDelete}
    onBack={handlers.config.onBack}
    onSaveTheme={handlers.settings.onSaveTheme}
    onSaveControls={handlers.settings.onSaveControls}
    onSaveTrust={handlers.settings.onSaveTrust}
    onSelectProvider={handlers.settings.onSelectProvider}
    onSaveCredentials={handlers.settings.onSaveCredentials}
    onRunDiagnostics={handlers.settings.onRunDiagnostics}
  />
)}
```

---

## Task 2.4: Add Trust State Hook

**File:** `apps/cli/src/hooks/use-trust.ts`

Ensure useTrust provides:
```typescript
export function useTrust(projectId: string) {
  const loadTrust = async () => {...};
  const saveTrust = async (config: TrustConfig) => {...};

  return {
    trust: trustConfig,
    capabilities: trustConfig?.capabilities,
    isTrusted: !!trustConfig,
    loadTrust,
    saveTrust,
  };
}
```

---

## Task 2.5: Update useAppState to Include Trust

**File:** `apps/cli/src/features/app/hooks/use-app-state.ts`

```typescript
export function useAppState() {
  // ... existing
  const trust = useTrust(projectId);

  return {
    // ... existing
    trust,
  };
}
```

---

## Validation

After wiring:
1. Open Settings
2. Change Theme → should persist
3. Provider section should show "Current" badge for active provider
4. Provider section should show "Configured" for providers with API key in keyring
5. Saving credentials should store in keyring and update status
