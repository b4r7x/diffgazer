# Web Backend Integration - Master Orchestrator

Connect the Web UI to existing backend and extract shared code to packages.

**Recommended Model**: Claude Opus 4.5 (best for backend/reasoning)
**Prerequisite**: Run `web-ui-creation` workflow first

## Context

This workflow:
1. Extracts shared UI components to `@repo/ui` package
2. Wires web app to use existing API
3. Ensures CORS and security work
4. Adds CLI command to launch web UI

---

## Phase 1: Extract Shared UI Package

### Agent 1.1: Create @repo/ui Package

```
subagent_type: "backend-architect"

Task: Create shared UI package structure.

Steps:
1. Create packages/ui/ directory
2. Create package.json with:
   - name: @repo/ui
   - exports for components and utils
   - peerDependencies: react, react-dom
   - dependencies: @base-ui-components/react, cva, clsx, tailwind-merge

3. Create packages/ui/tsconfig.json
4. Create packages/ui/src/index.ts
5. Create packages/ui/src/utils.ts (cn helper)

Add to root pnpm-workspace.yaml if not present.

Validation: pnpm install works

Output: @repo/ui package created
```

### Agent 1.2: Move Shared Components

```
subagent_type: "frontend-developer"

Task: Move shared UI components to @repo/ui.

Move from apps/web/src/components/ui/ to packages/ui/src/components/:
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

Update imports in moved files to use relative paths.
Export all from packages/ui/src/index.ts.

Update apps/web to import from @repo/ui:
- Either re-export in apps/web/src/components/ui/
- Or update all imports directly

Validation: pnpm type-check && pnpm build

Output: Components moved to shared package
```

---

## Phase 2: API Client Configuration

### Agent 2.1: Verify API Client

```
subagent_type: "backend-architect"

Task: Ensure @repo/api works for web browser.

Check packages/api/src/client.ts:
1. Uses fetch (browser compatible)
2. Handles SSE streams correctly
3. Sets credentials: 'include' for CORS
4. Handles Origin header

If issues found, fix them.

Create apps/web/src/lib/api.ts:
```typescript
import { createApiClient } from '@repo/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://127.0.0.1:7860';

export const api = createApiClient({
  baseUrl: API_BASE,
  credentials: 'include',
});
```

Create apps/web/.env and .env.example.

Validation: API client can make requests to server

Output: API client configured for web
```

---

## Phase 3: Wire Features

### Agent 3.1: Wire Review Feature

```
subagent_type: "backend-architect"

Task: Connect review feature to backend.

Update apps/web/src/features/review/api/review-api.ts:
- Use api from @/lib/api
- Implement streamTriage with SSE parsing
- Implement getReviews, getReview

Ensure AgentStreamEvent parsing matches server output.
Handle all event types:
- agent_start
- agent_thinking
- tool_call
- tool_result
- issue_found
- agent_complete
- orchestrator_complete

Test with actual server running.

Validation: Review flow works with real backend

Output: Review feature wired to backend
```

### Agent 3.2: Wire Settings Feature

```
subagent_type: "backend-architect"

Task: Connect settings feature to backend.

Update apps/web/src/features/settings/api/settings-api.ts:
- Use api from @/lib/api
- Implement all functions

Verify endpoints exist on server:
- GET /config/providers
- GET /config
- POST /config
- GET /settings
- POST /settings

If any missing, check server routes.

Validation: Settings can be read and saved

Output: Settings feature wired to backend
```

---

## Phase 4: Server CORS Configuration

### Agent 4.1: Update CORS

```
subagent_type: "backend-architect"

Task: Ensure server CORS allows web origin.

Check apps/server/src/api/middleware/cors.ts.

Required origins:
- http://127.0.0.1:* (any port)
- http://localhost:* (any port)

Web dev server typically runs on 5173.

Update CORS middleware if needed:
```typescript
const ALLOWED_ORIGIN_PATTERNS = [
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^http:\/\/localhost(:\d+)?$/,
];

function isAllowedOrigin(origin: string): boolean {
  return ALLOWED_ORIGIN_PATTERNS.some(pattern => pattern.test(origin));
}
```

Ensure:
- Credentials allowed
- Required headers exposed
- Preflight handled

Validation: Web app can make CORS requests

Output: CORS configured
```

---

## Phase 5: CLI Integration

### Agent 5.1: Add Web Command

```
subagent_type: "backend-developer"

Task: Add CLI command to launch web UI.

Create apps/cli/src/commands/web.ts:

```typescript
import { spawn } from 'child_process';
import path from 'path';
import open from 'open';
import { ensureServerRunning } from '../lib/server';

export async function webCommand(options: { dev?: boolean }) {
  // 1. Ensure server is running
  console.log('Starting server...');
  await ensureServerRunning();

  // 2. Start web
  const webDir = path.resolve(__dirname, '../../../../web');

  if (options.dev) {
    // Development mode - run vite dev
    const webProcess = spawn('pnpm', ['dev'], {
      cwd: webDir,
      stdio: 'inherit',
    });

    await waitForPort(5173);
    await open('http://127.0.0.1:5173');

    process.on('SIGINT', () => {
      webProcess.kill();
      process.exit(0);
    });
  } else {
    // Production mode - serve built files
    const distDir = path.join(webDir, 'dist');
    const express = await import('express');
    const app = express.default();

    app.use(express.static(distDir));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });

    app.listen(5173, '127.0.0.1', async () => {
      console.log('Web UI: http://127.0.0.1:5173');
      await open('http://127.0.0.1:5173');
    });
  }
}
```

Register in CLI:
```typescript
program
  .command('web')
  .description('Open Stargazer Web UI')
  .option('--dev', 'Run in development mode')
  .action(webCommand);
```

Add express to CLI dependencies if not present.

Validation: `stargazer web` opens browser

Output: Web command added to CLI
```

---

## Phase 6: Build Configuration

### Agent 6.1: Production Build

```
subagent_type: "backend-architect"

Task: Configure production build for web.

Update apps/web/vite.config.ts:
```typescript
export default defineConfig({
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom', '@tanstack/react-router'],
          ui: ['@base-ui-components/react'],
        },
      },
    },
  },
});
```

Add build script to package.json.

Test production build:
```bash
pnpm --filter web build
pnpm --filter web preview
```

Validation: Production build works

Output: Build configured
```

---

## Phase 7: Testing

### Agent 7.1: Integration Tests

```
subagent_type: "unit-testing:test-automator"

Task: Create integration tests for web app.

Create apps/web/src/__tests__/:

1. api-client.test.ts
   - Mock server responses
   - Test API client functions
   - Test SSE parsing

2. hooks.test.tsx
   - Test useTriageStream
   - Test useAgentActivity
   - Test useSettings

Use vitest and testing-library.

Validation: Tests pass

Output: Integration tests created
```

### Agent 7.2: E2E Verification

```
subagent_type: "code-reviewer"

Task: Manual E2E verification.

Checklist:
1. Start server: pnpm --filter server dev
2. Start web: pnpm --filter web dev
3. Open http://127.0.0.1:5173

Verify:
- [ ] Home page loads
- [ ] Can navigate to all pages
- [ ] Can configure provider in settings
- [ ] Can start new review
- [ ] Agent activity shows during review
- [ ] Issues display correctly
- [ ] Can view issue details
- [ ] Theme toggle works
- [ ] Responsive on mobile

Report any issues.

Output: E2E verification complete
```

---

## Phase 8: Cleanup

### Agent 8.1: Remove Duplicates

```
subagent_type: "code-simplifier:code-simplifier"

Task: Remove duplicate code between CLI and Web.

Check for:
1. Duplicate types (should be in @repo/schemas)
2. Duplicate API logic (should be in @repo/api)
3. Duplicate business logic (should be in @repo/core)
4. Duplicate UI components (should be in @repo/ui)

Move any duplicates to appropriate packages.

Validation: No code duplication

Output: Duplicates removed
```

### Agent 8.2: Update Documentation

```
subagent_type: "documentation-specialist"

Task: Update project documentation.

Update:
1. README.md - add web UI section
2. CLAUDE.md - add web package info
3. .claude/docs/structure-apps.md - add web structure

Add:
- How to run web UI
- How to build for production
- Architecture diagram

Validation: Docs are accurate

Output: Documentation updated
```

---

## Validation Checkpoints

After each phase:
```bash
pnpm type-check
pnpm build
pnpm test
```

Final check:
```bash
# Full E2E
pnpm --filter server dev &
pnpm --filter cli start web
# Test in browser
```

## Success Criteria

- [ ] @repo/ui package exists with shared components
- [ ] Web uses @repo/api for all API calls
- [ ] Web uses @repo/schemas for all types
- [ ] SSE streaming works
- [ ] Settings work
- [ ] CORS configured correctly
- [ ] CLI `web` command works
- [ ] Production build succeeds
- [ ] No duplicate code
- [ ] Documentation updated
