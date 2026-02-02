# Settings Feature Module

Unified settings feature module following Bulletproof React patterns.

## Architecture

```
features/settings/
├── api/
│   ├── index.ts
│   └── settings-api.ts         # Unified API client
├── hooks/
│   ├── index.ts
│   └── use-settings-state.ts   # Unified state management
├── index.ts                     # Feature exports
└── README.md
```

## Usage

### Import the unified hook

```typescript
import { useSettingsState } from "@/features/settings";

function MyComponent({ projectId, repoRoot }: Props) {
  const {
    // State
    isLoading,
    isSaving,
    settings,
    trust,
    config,
    providerStatus,
    isConfigured,
    error,

    // Computed
    isTrusted,
    activeProvider,

    // Actions
    loadAll,
    saveTheme,
    saveControlsMode,
    saveTrust,
    saveCredentials,
    deleteConfig,
  } = useSettingsState(projectId, repoRoot);

  // Load all settings on mount
  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Use the state and actions
  return (
    <Box>
      {isLoading ? <Text>Loading...</Text> : null}
      {settings ? <Text>Theme: {settings.theme}</Text> : null}
      {isTrusted ? <Text>Project is trusted</Text> : null}
    </Box>
  );
}
```

### Direct API usage

```typescript
import { settingsApi } from "@/features/settings";

// Load settings
const settings = await settingsApi.loadSettings();

// Save settings
await settingsApi.saveSettings({ theme: "dark", ... });

// Trust management
const trust = await settingsApi.loadTrust(projectId);
await settingsApi.saveTrust({ projectId, ... });

// Config management
const config = await settingsApi.loadConfig();
await settingsApi.saveConfig("anthropic", "sk-...", "claude-sonnet-4");
```

## Migration from Old Hooks

The unified hook replaces three separate hooks:

```typescript
// OLD (deprecated)
import { useSettings } from "@/hooks/use-settings";
import { useConfig } from "@/hooks/use-config";
import { useTrust } from "@/hooks/use-trust";

// NEW
import { useSettingsState } from "@/features/settings";
```

## State Shape

```typescript
interface SettingsState {
  isLoading: boolean;              // Any load operation in progress
  isSaving: boolean;               // Any save operation in progress
  settings: SettingsConfig | null; // Theme, controls, lenses, etc.
  trust: TrustConfig | null;       // Trust config for project
  config: {                        // Provider config
    provider: string;
    model?: string;
  } | null;
  providerStatus: ProviderStatus[]; // Status of all providers
  isConfigured: boolean;            // Has valid provider config
  error: { message: string } | null; // Any error from operations

  // Computed
  isTrusted: boolean;               // !!trust
  activeProvider: string | undefined; // config?.provider
}
```

## Actions

- `loadAll()` - Load all settings data in parallel (settings, trust, config, providers)
- `saveTheme(theme)` - Save theme preference
- `saveControlsMode(mode)` - Save controls mode (menu/keys)
- `saveTrust(config)` - Save trust configuration
- `saveCredentials(provider, apiKey, model?)` - Save provider credentials
- `deleteConfig()` - Delete provider configuration
