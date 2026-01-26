# Stargazer Web UI - Opus 4.5 Workflow

**Model:** Opus 4.5 (Claude)
**Purpose:** Wire UI to backend, hooks, type safety

**Prerequisite:** Complete `web-ui-gemini.md` first (UI components exist with mock data)

## Context

Stargazer web UI has visual components. Now wire to real backend:
- Server runs on `http://127.0.0.1:3847`
- Uses SSE for triage streaming
- Reuses `@repo/api`, `@repo/schemas`, `@repo/core`
- Use plain React state (useState, useReducer, Context) - no external state library
- **Match CLI structure**: `features/review/`, `features/sessions/`, `features/settings/`

---

## Task 1: API Layer

### Create `apps/web/src/lib/api.ts`
- Import `createApiClient` from `@repo/api`
- Base URL from env or default `http://127.0.0.1:3847`
- Export api client instance

### Create `apps/web/src/hooks/use-server-status.ts`
- Health check on `/health`
- Polling every 30s
- Return { connected, error, isChecking, retry }

---

## Task 2: Feature APIs

### `apps/web/src/features/settings/api/config-api.ts`
Functions:
- `getProviderStatus()` → `/config/status`
- `getConfig()` → `/config`
- `saveConfig(payload)` → PUT `/config`
- `validateApiKey(provider, key)` → POST `/config/validate`

### `apps/web/src/features/review/api/triage-api.ts`
Functions:
- `streamTriage(options, callbacks)` → SSE `/triage/stream`
  - Uses EventSource
  - Parse `AgentStreamEvent` from `@repo/schemas/agent-event`
  - Callbacks: onEvent, onError, onComplete
  - Return cleanup function

### `apps/web/src/features/review/api/review-history-api.ts`
Functions:
- `getReviewHistory()` → `/reviews`
- `getReview(id)` → `/reviews/:id`
- `deleteReview(id)` → DELETE `/reviews/:id`

### `apps/web/src/features/review/api/git-api.ts`
Functions:
- `getGitStatus()` → `/git/status`
- `getGitDiff(scope)` → `/git/diff?scope=`

### `apps/web/src/features/sessions/api/sessions-api.ts`
Functions:
- `getSessions()` → `/sessions`
- `getSession(id)` → `/sessions/:id`
- `deleteSession(id)` → DELETE `/sessions/:id`

---

## Task 3: React Context (Config Only)

### `apps/web/src/contexts/config-context.tsx`

Only config needs context (used across routes). Create a simple provider:

```typescript
interface ConfigContextValue {
  provider?: string
  model?: string
  isConfigured: boolean
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// Provider fetches on mount, exposes refresh
// No external state library needed
```

### Review State

Review state stays LOCAL to the review feature - no global store needed.
Use `useReducer` in `useTriageStream` hook for complex state transitions.

---

## Task 4: Feature Hooks

### `apps/web/src/features/settings/hooks/use-config.ts`
- Use ConfigContext
- Return { provider, model, isConfigured, isLoading, error, refresh }
- Separate `updateConfig` function that calls API + refresh

### `apps/web/src/features/review/hooks/use-triage-stream.ts`
- Use `useReducer` for state (issues, agents, currentAction, error)
- Actions: START, ADD_EVENT, COMPLETE, ERROR, RESET
- start(options) - start SSE stream, dispatch events
- stop() - cleanup stream
- Return { state, start, stop, selectIssue }

### `apps/web/src/features/review/hooks/use-review-history.ts`
- Local state for reviews
- Fetch on mount
- Return { reviews, isLoading, error, refresh, loadReview, removeReview }

### `apps/web/src/features/review/hooks/use-git-status.ts`
- Local state for git status
- Return { status, hasUnstaged, hasStaged, isLoading, error, refresh }

### `apps/web/src/features/sessions/hooks/use-sessions.ts`
- Local state for sessions list
- Fetch on mount
- Return { sessions, isLoading, error, refresh, deleteSession }

---

## Task 5: Wire Routes

### Update `apps/web/src/app/routes/__root.tsx`
- Use useConfig() for header props
- Use useServerStatus() for connection check
- Show error screen if server disconnected

### Update `apps/web/src/app/routes/index.tsx`
- Use useConfig() for provider display
- Use useReviewHistory() for last review
- Navigate with search params (scope)

### Update `apps/web/src/app/routes/review/index.tsx`
- Get scope from search params
- Use useTriageStream()
- Auto-start review when scope present
- Handle loading/error states
- Cleanup on unmount

### Update `apps/web/src/app/routes/review/$reviewId.tsx`
- Load existing review by ID
- Use useReviewHistory().loadReview(id)
- Display in ReviewScreen

### Create `apps/web/src/app/routes/review-history.tsx`
- Use useReviewHistory()
- Loading spinner
- Error with retry
- Navigate to /review/$id on select

### Create `apps/web/src/app/routes/sessions.tsx`
- Use useSessions()
- List sessions with date, status
- Click to view session details
- Delete session option

### Update `apps/web/src/app/routes/settings.tsx`
- Use useConfig()
- Form state for provider/model/apiKey
- Validate API key before save
- Success/error feedback

---

## Task 6: CLI Web Command

### Create `apps/cli/src/commands/web.ts`
- Check if web app built (apps/web/dist exists)
- Spawn `pnpm preview --port <port>` in web dir
- Option to open browser
- Handle SIGINT cleanup

### Update `apps/cli/src/index.ts`
Add command:
```
stargazer web [-p port] [-o open]
```

---

## Task 7: Wrap App with ConfigProvider

In `apps/web/src/main.tsx` or `__root.tsx`:
- Wrap app with ConfigProvider
- Provider fetches config on mount
- Children can use `useConfig()` hook

## Task 8: Type Safety

Verify all imports from `@repo/schemas`:
- `TriageOptions`, `TriageResult`, `TriageIssue`, `TriageScope`
- `AgentStreamEvent`, `AgentState`, `AgentMeta`
- `ProviderStatus`, `ConfigPayload`
- `ReviewHistoryEntry`, `ReviewHistoryList`
- `Session`, `SessionList`

Run type check:
```bash
pnpm type-check
```

---

## Task 9: Integration Test

1. Start server: `pnpm --filter server dev`
2. Start web: `pnpm --filter web dev`

Test checklist:
- [ ] Server connection indicator works
- [ ] Provider status loads from API
- [ ] Settings save and persist
- [ ] Starting review creates SSE stream
- [ ] Agent events appear in real-time
- [ ] Issues populate as found
- [ ] Issue selection works
- [ ] Review history loads at /review-history
- [ ] Review history item loads review at /review/:id
- [ ] Sessions list loads at /sessions
- [ ] Error states display correctly
- [ ] Cleanup works on navigation

---

## Validation

```bash
# Type check
pnpm type-check

# Build
pnpm build

# Test CLI command
cd apps/cli
pnpm build
./bin/stargazer web --help
```

---

## Success Criteria

- [ ] API client connects to server
- [ ] ConfigContext provides provider status
- [ ] useTriageStream handles SSE events
- [ ] All routes use real data
- [ ] /review-history shows past reviews
- [ ] /sessions shows sessions list
- [ ] Error handling throughout
- [ ] CLI web command works
- [ ] No TypeScript errors
- [ ] Build passes
- [ ] Full flow works end-to-end

---

## Troubleshooting

### CORS errors
- Server should allow localhost origins
- Check `apps/server/src/middleware/cors.ts`

### SSE not connecting
- Verify URL includes query params
- Check server sends SSE headers
- Look for connection errors in console

### Types not matching
- Rebuild packages: `pnpm build`
- Check schema versions match

### State not updating
- Verify reducer dispatch is called
- Check React DevTools for state
- Ensure useReducer returns are used correctly
