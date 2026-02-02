# Feature: Settings

## Overview

The Settings system manages user preferences and project trust configurations. Settings are stored locally in `~/.config/stargazer/` and persisted across sessions.

## Key Files

| File | Purpose |
|------|---------|
| `packages/schemas/src/settings.ts` | Settings and trust Zod schemas |
| `packages/core/src/storage/settings-storage.ts` | Persistence layer for settings |
| `apps/server/src/api/routes/settings.ts` | REST API for settings |
| `apps/cli/src/features/settings/` | CLI settings feature module |

## Data Model

### SettingsConfig

User preferences for the application:

```typescript
interface SettingsConfig {
  theme: "auto" | "dark" | "light" | "terminal";
  controlsMode: "menu" | "keys";
  defaultLenses: LensId[];
  defaultProfile: ProfileId | null;
  severityThreshold: TriageSeverity;
}
```

| Field | Type | Description |
|-------|------|-------------|
| `theme` | enum | UI color theme |
| `controlsMode` | enum | Show menu or keyboard shortcuts |
| `defaultLenses` | `LensId[]` | Default lenses for reviews |
| `defaultProfile` | `ProfileId | null` | Default review profile |
| `severityThreshold` | `TriageSeverity` | Minimum severity to show |

### TrustConfig

Per-project trust settings:

```typescript
interface TrustConfig {
  projectId: string;
  repoRoot: string;
  trustedAt: string;
  capabilities: TrustCapabilities;
  trustMode: "persistent" | "session";
}

interface TrustCapabilities {
  readFiles: boolean;
  readGit: boolean;
  runCommands: boolean;
}
```

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | string | Unique project identifier |
| `repoRoot` | string | Absolute path to repo root |
| `trustedAt` | ISO datetime | When trust was granted |
| `capabilities` | object | Granted permissions |
| `trustMode` | enum | `persistent` or `session` only |

## Storage Locations

Settings are stored in the user config directory:

```
~/.config/stargazer/
├── config.json      # AI provider config
└── trusted.json     # Project trust configs
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/settings` | GET | Get current settings |
| `/settings` | POST | Save settings |
| `/settings/trust` | GET | Get trust for project (query: projectId) |
| `/settings/trust` | POST | Save trust config |
| `/settings/trust` | DELETE | Remove trust (query: projectId) |
| `/settings/trust/list` | GET | List all trusted projects |

### Example: Get Settings

```bash
curl http://localhost:3000/settings
```

Response:
```json
{
  "settings": {
    "theme": "auto",
    "controlsMode": "keys",
    "defaultLenses": ["correctness"],
    "defaultProfile": null,
    "severityThreshold": "medium"
  }
}
```

### Example: Save Trust

```bash
curl -X POST http://localhost:3000/settings/trust \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "abc123",
    "repoRoot": "/path/to/repo",
    "trustedAt": "2024-01-24T10:00:00.000Z",
    "capabilities": {
      "readFiles": true,
      "readGit": true,
      "runCommands": false
    },
    "trustMode": "persistent"
  }'
```

## Storage Functions

```typescript
import {
  saveSettings,
  loadSettings,
  saveTrust,
  loadTrust,
  listTrustedProjects,
  removeTrust,
} from "@repo/core/storage";

// Settings operations
const settings = await loadSettings();
await saveSettings({ theme: "dark", ... });

// Trust operations
await saveTrust({ projectId, repoRoot, ... });
const trust = await loadTrust(projectId);
const allTrusted = await listTrustedProjects();
await removeTrust(projectId);
```

## CLI Feature Structure

```
apps/cli/src/features/settings/
├── api/
│   ├── index.ts
│   └── settings-api.ts     # API client for settings
├── hooks/
│   ├── index.ts
│   └── use-settings-state.ts  # Settings state hook
└── index.ts                # Feature exports
```

## Usage in CLI

```typescript
import { useSettingsState } from "@/features/settings";

function SettingsScreen() {
  const { settings, isLoading, error, updateSettings } = useSettingsState();

  if (isLoading) return <Loading />;
  if (error) return <Error message={error.message} />;

  return (
    <ThemeSelector
      value={settings.theme}
      onChange={(theme) => updateSettings({ ...settings, theme })}
    />
  );
}
```

## Cross-References

- [Packages: Schemas](../packages/schemas.md) - Settings schemas
- [Packages: Core](../packages/core.md) - Storage utilities
- [Reference: API Endpoints](../reference/api-endpoints.md) - Full API docs
