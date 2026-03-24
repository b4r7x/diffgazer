# Data Model: CLI Backend Integration

**Branch**: `005-cli-backend-integration` | **Date**: 2026-03-24

## Entities

### 1. API Client Instance

The central data access point for all CLI screens.

| Attribute | Description |
|-----------|-------------|
| baseUrl | Server origin (`http://127.0.0.1:3000`) |
| projectRoot | Current working directory (sent as `x-diffgazer-project-root` header) |

**Lifecycle**: Created once at app initialization, before React tree renders. Lives as a module-level singleton.

**Relationships**: Consumed by all hooks and screens that need backend data.

---

### 2. Server Connection State

Gates the entire UI — no screens render until connected.

| Attribute | Type | Description |
|-----------|------|-------------|
| status | `"checking" \| "connected" \| "error"` | Current connection state |
| message | `string \| null` | Error message when status is "error" |

**State transitions**:
```
[checking] --health OK--> [connected]
[checking] --health fail--> [error]
[error] --retry--> [checking]
[connected] --poll fail--> [error]
```

**Validation**: Health check calls `GET /api/health`, expects `{ status: "ok" }`.

---

### 3. Init Response (App Bootstrap Data)

Loaded once after server connects, drives home screen and config guards.

| Attribute | Type | Description |
|-----------|------|-------------|
| config | `{ provider, model } \| null` | Active provider configuration |
| providers | `ProviderStatus[]` | All providers with status (hasApiKey, model, isActive) |
| settings | `SettingsConfig` | Current settings (secretsStorage, defaultLenses, agentExecution) |
| project | `{ projectId, path, trust } \| null` | Current project info and trust state |
| setup | `SetupStatus` | What's configured: secretsStorage, provider, model, trust, isConfigured |

**Lifecycle**: Fetched on app bootstrap via `api.loadInit()`. Re-fetched after config mutations.

---

### 4. Settings Config

Persisted user preferences, shared between CLI and web.

| Attribute | Type | Description |
|-----------|------|-------------|
| secretsStorage | `"file" \| "keyring"` | Where API keys are stored |
| defaultLenses | `LensId[]` | Default analysis lenses (correctness, security, etc.) |
| agentExecution | `"parallel" \| "sequential"` | How review agents run |
| theme | `string` | Web theme (CLI ignores this, uses own theme system) |
| severityThreshold | `string` | Minimum severity to report |
| defaultProfile | `string \| null` | Default review profile |

**Lifecycle**: Loaded per-screen via `api.getSettings()`. Saved via `api.saveSettings(partial)`.

---

### 5. Trust Config

Per-project trust grant with capabilities.

| Attribute | Type | Description |
|-----------|------|-------------|
| projectId | `string` | Project identifier |
| repoRoot | `string` | Absolute path to repo root |
| capabilities | `{ readFiles, runCommands }` | Granted capabilities (both boolean) |
| trustMode | `string` | Trust mode identifier |
| trustedAt | `string` | ISO timestamp of trust grant |

**Lifecycle**: Checked on bootstrap (via init response). Saved via `api.saveTrust()`. Revoked via `api.deleteTrust()`.

---

### 6. Provider Status

Configuration state for each AI provider.

| Attribute | Type | Description |
|-----------|------|-------------|
| id | `string` | Provider ID (gemini, zai, zai-coding, openrouter) |
| name | `string` | Display name |
| hasApiKey | `boolean` | Whether credentials are stored |
| model | `string \| null` | Selected model |
| isActive | `boolean` | Whether this is the active provider |

**Lifecycle**: Loaded via `api.getProviderStatus()` or from init response. Mutated via `api.saveConfig()`, `api.activateProvider()`, `api.deleteProviderCredentials()`.

---

### 7. Review State (Streaming)

Real-time state during an active code review, driven by SSE events.

| Attribute | Type | Description |
|-----------|------|-------------|
| steps | `StepState[]` | 5 steps: diff, context, review, enrich, report (each: pending/active/completed/error) |
| agents | `AgentState[]` | Agent states: detective, guardian, optimizer, simplifier, tester |
| issues | `ReviewIssue[]` | Issues found so far (grows during stream) |
| events | `ReviewEvent[]` | Raw event log for activity display |
| fileProgress | `FileProgress` | Files: total, current, currentFile, completed[] |
| isStreaming | `boolean` | Whether stream is active |
| error | `string \| null` | Error message if stream failed |
| startedAt | `Date \| null` | Stream start timestamp |

**State transitions**:
```
[idle] --start()--> [isStreaming=true, steps=all pending]
  events arrive → reducer updates steps, agents, issues, fileProgress
[streaming] --complete event--> [isStreaming=false]
[streaming] --error event--> [isStreaming=false, error set]
[streaming] --abort--> [isStreaming=false]
```

**Reducer**: Shared `reviewReducer` from `@diffgazer/core/review` handles all 20+ event types.

---

### 8. Saved Review

Persisted review result loaded from history or resume.

| Attribute | Type | Description |
|-----------|------|-------------|
| id | `string (UUID)` | Review identifier |
| projectPath | `string` | Project path at review time |
| branch | `string` | Git branch |
| mode | `"staged" \| "unstaged"` | Review mode |
| timestamp | `string` | ISO timestamp |
| duration | `number` | Duration in ms |
| result | `ReviewResult` | Full results (issues, summary, metadata) |
| gitContext | `ReviewGitContext` | Git state at review time |

**Lifecycle**: Created by server on review completion. Listed via `api.getReviews()`. Loaded via `api.getReview(id)`. Deleted via `api.deleteReview(id)`.

---

### 9. Review Issue

Individual code issue found during review.

| Attribute | Type | Description |
|-----------|------|-------------|
| id | `string` | Issue identifier |
| title | `string` | Issue title |
| severity | `"blocker" \| "high" \| "medium" \| "low" \| "nit"` | Severity level |
| category | `string` | Issue category |
| file | `string` | File path |
| line | `number` | Line number |
| description | `string` | Symptom description |
| evidence | `CodeEvidence` | Code snippet with line numbers |
| explanation | `string` | Why it matters |
| fixPlan | `FixPlanItem[]` | Suggested fix steps (interactive checklist) |
| trace | `TraceStep[]` | Agent tool trace (step number, tool, output) |
| suggestedPatch | `string \| null` | Diff of suggested fix |
| enrichment | `IssueEnrichment` | Git blame + surrounding context |

---

## Data Flow Diagrams

### App Bootstrap Flow
```
CLI starts → Server starts (embedded/dev) → useServerStatus polls /api/health
  → connected → api.checkConfig()
    → configured: true → navigate(home), load init data
    → configured: false → navigate(onboarding)
```

### Review Streaming Flow
```
User selects "Review Unstaged/Staged"
  → api.getActiveReviewSession(mode)
    → active session found → api.resumeReviewStream(id)
    → no active session → api.streamReviewWithEvents({ mode, lenses })
  → SSE events arrive → reviewReducer dispatches → UI updates in real-time
  → complete event → transition to summary phase
  → user clicks "View Results" → transition to results phase
```

### Settings Save Flow
```
Screen mounts → api.getSettings() → populate form with current values
User edits → local state updates (dirty tracking)
User saves → api.saveSettings({ field: value }) → show success/error
User navigates back → settings hub re-fetches current values
```

### Onboarding Completion Flow
```
User completes 6 steps (storage, provider, key, model, analysis, execution)
  → api.saveSettings({ secretsStorage, defaultLenses, agentExecution })
  → api.saveConfig({ provider, apiKey, model })
  → navigate(home)
```
