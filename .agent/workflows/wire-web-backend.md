# Wire Web Backend Integration

Connect the Web UI to the existing Stargazer backend and extract shared code to packages.

**Model**: Use Claude Opus 4.5 for this workflow (better for backend/reasoning).

## Prerequisites

- Web UI created (run `create-web-ui` workflow first)
- Load skills: `stargazer-context`

---

## Phase 1: Extract Shared UI Package

### 1.1 Create @repo/ui Package

```bash
mkdir -p packages/ui/src/components
cd packages/ui
pnpm init
```

Create `packages/ui/package.json`:
```json
{
  "name": "@repo/ui",
  "version": "0.0.1",
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./components/*": "./src/components/*.tsx",
    "./utils": "./src/utils.ts"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "dependencies": {
    "@base-ui-components/react": "^1.0.0",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  }
}
```

### 1.2 Move Shared Components

Move from `apps/web/src/components/ui/` to `packages/ui/src/components/`:
- button.tsx
- card.tsx
- badge.tsx
- dialog.tsx
- tabs.tsx
- select.tsx
- input.tsx
- textarea.tsx
- skeleton.tsx
- progress.tsx
- code-block.tsx

### 1.3 Create Package Exports

Create `packages/ui/src/index.ts`:
```typescript
export * from './components/button';
export * from './components/card';
export * from './components/badge';
// ... etc
export { cn } from './utils';
```

### 1.4 Create Shared Utils

Create `packages/ui/src/utils.ts`:
```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 1.5 Update Web App Imports

Update `apps/web/src/components/ui/*` to re-export from `@repo/ui`:
```typescript
// apps/web/src/components/ui/button.tsx
export { Button, buttonVariants } from '@repo/ui/components/button';
```

Or update all imports directly to use `@repo/ui`.

---

## Phase 2: Shared Types Verification

### 2.1 Verify Schema Exports

Check `packages/schemas/src/index.ts` exports all needed types:
- `AgentStreamEvent`
- `AgentMeta`
- `AgentId`
- `AgentState`
- `TriageIssue`
- `TriageResult`
- `LensId`
- `ProfileId`
- `SettingsConfig`
- `UserConfig`

### 2.2 Add Missing Types

If any types are missing, add them to appropriate schema files.

---

## Phase 3: API Client Configuration

### 3.1 Verify @repo/api Works for Web

Check `packages/api/src/client.ts`:
- Uses fetch (works in browser)
- Handles SSE streams
- Includes CSRF token handling
- Sets correct Origin header

### 3.2 Configure API Base URL

Create `apps/web/src/lib/api.ts`:
```typescript
import { createApiClient } from '@repo/api';

// Server runs on 7860 by default
const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:7860';

export const api = createApiClient({
  baseUrl: API_BASE,
  // Include credentials for CORS
  credentials: 'include',
});
```

### 3.3 Create Environment Config

Create `apps/web/.env`:
```
VITE_API_URL=http://127.0.0.1:7860
```

Create `apps/web/.env.example`:
```
VITE_API_URL=http://127.0.0.1:7860
```

---

## Phase 4: Wire Review Feature

### 4.1 Update Review API

Ensure `apps/web/src/features/review/api/review-api.ts` uses @repo/api:
```typescript
import { api } from '@/lib/api';
import type {
  TriageOptions,
  TriageResult,
  AgentStreamEvent,
  ReviewHistoryEntry
} from '@repo/schemas';

export async function streamTriage(
  options: TriageOptions,
  onEvent: (event: AgentStreamEvent) => void
): Promise<TriageResult> {
  const response = await api.post('/triage/stream', options, {
    stream: true,
  });

  // Handle SSE
  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  // Parse SSE events...
}

export async function getReviews(): Promise<ReviewHistoryEntry[]> {
  return api.get('/reviews');
}

export async function getReview(id: string): Promise<TriageResult> {
  return api.get(`/reviews/${id}`);
}
```

### 4.2 Wire useTriageStream Hook

Update `apps/web/src/features/review/hooks/use-triage-stream.ts`:
```typescript
import { useState, useCallback, useRef } from 'react';
import { streamTriage } from '../api/review-api';
import type { AgentStreamEvent, TriageIssue, TriageOptions } from '@repo/schemas';

export function useTriageStream() {
  const [events, setEvents] = useState<AgentStreamEvent[]>([]);
  const [issues, setIssues] = useState<TriageIssue[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const start = useCallback(async (options: TriageOptions) => {
    setIsRunning(true);
    setEvents([]);
    setIssues([]);
    setError(null);

    abortRef.current = new AbortController();

    try {
      const result = await streamTriage(options, (event) => {
        setEvents(prev => [...prev, event]);

        if (event.type === 'issue_found') {
          setIssues(prev => [...prev, event.issue]);
        }
      });

      return result;
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      throw e;
    } finally {
      setIsRunning(false);
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsRunning(false);
  }, []);

  return { events, issues, isRunning, error, start, stop };
}
```

### 4.3 Wire useAgentActivity Hook

Update `apps/web/src/features/review/hooks/use-agent-activity.ts`:
```typescript
import { useMemo } from 'react';
import type { AgentStreamEvent, AgentState, AgentId } from '@repo/schemas';
import { AGENT_METADATA } from '@repo/schemas';

export function useAgentActivity(events: AgentStreamEvent[]) {
  return useMemo(() => {
    const agentStates = new Map<AgentId, AgentState>();
    let currentAction: string | null = null;

    // Initialize all agents as queued
    for (const [id, meta] of Object.entries(AGENT_METADATA)) {
      agentStates.set(id as AgentId, {
        id: id as AgentId,
        meta,
        status: 'queued',
        progress: 0,
        issueCount: 0,
      });
    }

    // Process events
    for (const event of events) {
      switch (event.type) {
        case 'agent_start': {
          const state = agentStates.get(event.agent.id);
          if (state) {
            state.status = 'running';
            state.progress = 10;
          }
          break;
        }
        case 'tool_call': {
          currentAction = `${event.tool}: ${event.input}`;
          const state = agentStates.get(event.agent);
          if (state) {
            state.currentAction = currentAction;
            state.progress = 50;
          }
          break;
        }
        case 'issue_found': {
          const state = agentStates.get(event.agent);
          if (state) {
            state.issueCount++;
          }
          break;
        }
        case 'agent_complete': {
          const state = agentStates.get(event.agent);
          if (state) {
            state.status = 'complete';
            state.progress = 100;
            state.currentAction = undefined;
          }
          currentAction = null;
          break;
        }
      }
    }

    const agents = Array.from(agentStates.values());
    const completedCount = agents.filter(a => a.status === 'complete').length;
    const progress = (completedCount / agents.length) * 100;

    return { agents, currentAction, progress };
  }, [events]);
}
```

---

## Phase 5: Wire Settings Feature

### 5.1 Update Settings API

Create `apps/web/src/features/settings/api/settings-api.ts`:
```typescript
import { api } from '@/lib/api';
import type { UserConfig, SettingsConfig, ProviderStatus } from '@repo/schemas';

export async function getProviderStatus(): Promise<ProviderStatus[]> {
  const response = await api.get('/config/providers');
  return response.providers;
}

export async function getConfig(): Promise<UserConfig | null> {
  return api.get('/config');
}

export async function saveConfig(config: Partial<UserConfig>): Promise<void> {
  await api.post('/config', config);
}

export async function getSettings(): Promise<SettingsConfig> {
  return api.get('/settings');
}

export async function saveSettings(settings: Partial<SettingsConfig>): Promise<void> {
  await api.post('/settings', settings);
}
```

### 5.2 Create Settings Hooks

Create `apps/web/src/features/settings/hooks/use-settings.ts`:
```typescript
import { useState, useEffect, useCallback } from 'react';
import { getSettings, saveSettings } from '../api/settings-api';
import type { SettingsConfig } from '@repo/schemas';

export function useSettings() {
  const [settings, setSettings] = useState<SettingsConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getSettings()
      .then(setSettings)
      .catch(setError)
      .finally(() => setIsLoading(false));
  }, []);

  const update = useCallback(async (updates: Partial<SettingsConfig>) => {
    await saveSettings(updates);
    setSettings(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  return { settings, isLoading, error, update };
}
```

Create `apps/web/src/features/settings/hooks/use-config.ts`:
```typescript
import { useState, useEffect, useCallback } from 'react';
import { getProviderStatus, getConfig, saveConfig } from '../api/settings-api';
import type { UserConfig, ProviderStatus } from '@repo/schemas';

export function useConfig() {
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [config, setConfig] = useState<UserConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([getProviderStatus(), getConfig()])
      .then(([providers, config]) => {
        setProviders(providers);
        setConfig(config);
      })
      .finally(() => setIsLoading(false));
  }, []);

  const updateConfig = useCallback(async (updates: Partial<UserConfig>) => {
    await saveConfig(updates);
    setConfig(prev => prev ? { ...prev, ...updates } : updates as UserConfig);
  }, []);

  return { providers, config, isLoading, updateConfig };
}
```

---

## Phase 6: Server CORS Update

### 6.1 Verify CORS Allows Web Origin

Check `apps/server/src/api/middleware/cors.ts`:

The server should allow:
- `http://127.0.0.1:*` (any port)
- `http://localhost:*` (any port)

If web runs on port 5173 (Vite default), ensure it's allowed.

### 6.2 Update CORS if Needed

```typescript
const ALLOWED_ORIGINS = [
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^http:\/\/localhost(:\d+)?$/,
];
```

---

## Phase 7: CLI Integration

### 7.1 Add Web Command to CLI

Create `apps/cli/src/commands/web.ts`:
```typescript
import { spawn } from 'child_process';
import path from 'path';
import open from 'open';

export async function webCommand() {
  // Ensure server is running
  await ensureServerRunning();

  // Start web dev server
  const webDir = path.resolve(__dirname, '../../../web');
  const webProcess = spawn('pnpm', ['dev'], {
    cwd: webDir,
    stdio: 'inherit',
  });

  // Wait for server to be ready
  await waitForServer('http://127.0.0.1:5173');

  // Open browser
  await open('http://127.0.0.1:5173');

  // Handle cleanup
  process.on('SIGINT', () => {
    webProcess.kill();
    process.exit(0);
  });
}
```

### 7.2 Register Command

Update `apps/cli/src/index.ts`:
```typescript
program
  .command('web')
  .description('Open Stargazer Web UI')
  .action(webCommand);
```

---

## Phase 8: Build & Bundle

### 8.1 Production Build

Update `apps/web/vite.config.ts` for production:
```typescript
export default defineConfig({
  build: {
    outDir: 'dist',
    // Bundle for embedding in CLI
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          ui: ['@base-ui-components/react'],
        },
      },
    },
  },
});
```

### 8.2 Serve Static in CLI (Optional)

For distribution, consider serving built web files from CLI:
```typescript
// apps/cli/src/commands/web.ts
import express from 'express';
import path from 'path';

export async function webCommand() {
  const app = express();
  const webDist = path.resolve(__dirname, '../../../web/dist');

  app.use(express.static(webDist));
  app.get('*', (req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });

  app.listen(5173, '127.0.0.1', () => {
    console.log('Web UI: http://127.0.0.1:5173');
    open('http://127.0.0.1:5173');
  });
}
```

---

## Phase 9: Testing

### 9.1 Integration Tests

Create `apps/web/src/__tests__/integration.test.ts`:
- Test API client connects to server
- Test SSE stream works
- Test settings save/load

### 9.2 E2E Test (Manual)

1. Start server: `pnpm --filter server dev`
2. Start web: `pnpm --filter web dev`
3. Open http://127.0.0.1:5173
4. Configure provider
5. Run a review
6. Verify agent activity shows
7. Verify issues display

---

## Validation Checklist

```bash
# Type check all packages
pnpm type-check

# Build all
pnpm build

# Run tests
pnpm test

# Manual E2E
pnpm --filter server dev &
pnpm --filter web dev
# Open browser and test
```

## Success Criteria

- [ ] @repo/ui package created with shared components
- [ ] Web app uses @repo/api for all API calls
- [ ] Web app uses @repo/schemas for all types
- [ ] SSE streaming works (agent events appear)
- [ ] Settings can be read and saved
- [ ] CORS allows web origin
- [ ] CLI `web` command works
- [ ] Production build succeeds
- [ ] No duplicate code between CLI and Web
